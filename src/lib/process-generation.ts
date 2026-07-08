import { fillPromptTemplate } from "@/lib/prompt";
import { generateImage } from "@/lib/openai";
import {
  buildOutputKey,
  fetchImageFromUrl,
  uploadImage,
} from "@/lib/storage";
import { buildPricingSettings, calculateCost } from "@/lib/cost";
import { resolveImageModel } from "@/lib/image-models";
import {
  DEFAULT_GENERATION_HEIGHT,
  DEFAULT_GENERATION_QUALITY,
  DEFAULT_GENERATION_WIDTH,
} from "@/lib/shapes";
import { createAdminClient } from "@/lib/supabase/admin";
import { kickGenerationQueue } from "@/lib/generation-queue";

export async function processGenerationJob(generationId: string): Promise<void> {
  const supabase = createAdminClient();
  const startedAt = Date.now();

  const { data: generation, error: claimError } = await supabase
    .from("generations")
    .update({
      status: "processing",
      processing_started_at: new Date().toISOString(),
    })
    .eq("id", generationId)
    .eq("status", "pending")
    .select("*")
    .single();

  if (claimError || !generation) {
    return;
  }

  console.info(`[generate] start ${generationId} order=${generation.order_number}`);

  try {
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("key, value");

    let promptTemplate: string;
    let requiresImage: boolean;

    if (generation.art_style_id) {
      const { data: artStyle } = await supabase
        .from("art_styles")
        .select("*")
        .eq("id", generation.art_style_id)
        .single();

      if (!artStyle) {
        throw new Error("ไม่พบ Art Style ที่เลือก");
      }

      promptTemplate = artStyle.prompt_template;
      requiresImage = true;
    } else {
      const { data: pattern } = await supabase
        .from("patterns")
        .select("*")
        .eq("id", generation.pattern_id!)
        .single();

      if (!pattern) {
        throw new Error("ไม่พบรูปแบบที่เลือก");
      }

      promptTemplate = pattern.prompt_template;
      requiresImage = pattern.requires_image;
    }

    if (requiresImage && !generation.uploaded_image_url) {
      throw new Error(
        generation.art_style_id
          ? "กรุณาอัปโหลดรูปสำหรับ Art Style"
          : "รูปแบบนี้ต้องอัปโหลดรูปคน"
      );
    }

    const promptUsed =
      generation.prompt_used ||
      fillPromptTemplate(
        promptTemplate,
        Object.values(generation.input_text ?? {})
      );

    let inputImageBuffer: Buffer | undefined;
    if (requiresImage && generation.uploaded_image_url) {
      inputImageBuffer = await fetchImageFromUrl(generation.uploaded_image_url);
    }

    const apiStartedAt = Date.now();
    const { imageBuffer, usage, model } = await generateImage({
      prompt: promptUsed,
      width: DEFAULT_GENERATION_WIDTH,
      height: DEFAULT_GENERATION_HEIGHT,
      quality: DEFAULT_GENERATION_QUALITY,
      model: resolveImageModel(settingsRows ?? []),
      inputImageBuffer,
      inputImageMimeType: "image/png",
    });
    const processingDurationMs = Date.now() - apiStartedAt;

    const outputKey = buildOutputKey(
      generation.user_id,
      generation.order_number ?? "output"
    );
    const outputImageUrl = await uploadImage(
      outputKey,
      imageBuffer,
      "image/png",
      { upsert: true }
    );

    const pricing = buildPricingSettings(settingsRows ?? []);
    const { costUsd, costThb } = calculateCost(usage, pricing);

    const { error: updateError } = await supabase
      .from("generations")
      .update({
        output_image_url: outputImageUrl,
        prompt_used: promptUsed,
        model,
        input_text_tokens: usage.input_text_tokens,
        input_image_tokens: usage.input_image_tokens,
        output_image_tokens: usage.output_image_tokens,
        total_tokens: usage.total_tokens,
        cost_usd: costUsd,
        cost_thb: costThb,
        status: "success",
        processing_started_at: null,
      })
      .eq("id", generationId);

    if (updateError) {
      throw new Error("สร้างรูปสำเร็จแต่บันทึกไม่ครบ");
    }

    // แยกจาก update หลัก — คอลัมน์นี้มาจาก migration 010
    // ถ้าฐานข้อมูลยังไม่ได้รัน migration งานต้องไม่ล้ม
    const { error: durationError } = await supabase
      .from("generations")
      .update({ processing_duration_ms: processingDurationMs })
      .eq("id", generationId);
    if (durationError) {
      console.warn(
        `[generate] duration not saved (${durationError.message}) — รัน migration 010 เพื่อเก็บเวลา API`
      );
    }

    console.info(
      `[generate] success ${generationId} ${Math.round((Date.now() - startedAt) / 1000)}s`
    );
  } catch (error) {
    console.error(
      `[generate] failed ${generationId} ${Math.round((Date.now() - startedAt) / 1000)}s`,
      error
    );
    const message =
      error instanceof Error
        ? error.message
        : "สร้างรูปไม่สำเร็จ กรุณาลองใหม่";

    await supabase
      .from("generations")
      .update({
        status: "failed",
        error_message: message,
        processing_started_at: null,
      })
      .eq("id", generationId);
  } finally {
    void kickGenerationQueue();
  }
}
