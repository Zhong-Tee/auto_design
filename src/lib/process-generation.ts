import { fillPromptTemplate } from "@/lib/prompt";
import { generateImage } from "@/lib/openai";
import {
  buildOutputKey,
  fetchImageFromUrl,
  uploadImage,
} from "@/lib/storage";
import { buildPricingSettings, calculateCost } from "@/lib/cost";
import {
  DEFAULT_GENERATION_HEIGHT,
  DEFAULT_GENERATION_QUALITY,
  DEFAULT_GENERATION_WIDTH,
} from "@/lib/shapes";
import { createAdminClient } from "@/lib/supabase/admin";

export async function processGenerationJob(generationId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: generation, error: fetchError } = await supabase
    .from("generations")
    .select("*")
    .eq("id", generationId)
    .single();

  if (fetchError || !generation) {
    console.error("Generation not found:", generationId, fetchError);
    return;
  }

  if (generation.status !== "pending") {
    return;
  }

  try {
    const [{ data: pattern }, { data: settingsRows }] = await Promise.all([
      supabase
        .from("patterns")
        .select("*")
        .eq("id", generation.pattern_id!)
        .single(),
      supabase.from("app_settings").select("key, value"),
    ]);

    if (!pattern) {
      throw new Error("ไม่พบรูปแบบที่เลือก");
    }

    if (pattern.requires_image && !generation.uploaded_image_url) {
      throw new Error("รูปแบบนี้ต้องอัปโหลดรูปคน");
    }

    const promptUsed =
      generation.prompt_used ||
      fillPromptTemplate(
        pattern.prompt_template,
        Object.values(generation.input_text ?? {})
      );

    let inputImageBuffer: Buffer | undefined;
    if (pattern.requires_image && generation.uploaded_image_url) {
      inputImageBuffer = await fetchImageFromUrl(generation.uploaded_image_url);
    }

    const { imageBuffer, usage } = await generateImage({
      prompt: promptUsed,
      width: DEFAULT_GENERATION_WIDTH,
      height: DEFAULT_GENERATION_HEIGHT,
      quality: DEFAULT_GENERATION_QUALITY,
      inputImageBuffer,
      inputImageMimeType: "image/png",
    });

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
        input_text_tokens: usage.input_text_tokens,
        input_image_tokens: usage.input_image_tokens,
        output_image_tokens: usage.output_image_tokens,
        total_tokens: usage.total_tokens,
        cost_usd: costUsd,
        cost_thb: costThb,
        status: "success",
      })
      .eq("id", generationId);

    if (updateError) {
      throw new Error("สร้างรูปสำเร็จแต่บันทึกไม่ครบ");
    }
  } catch (error) {
    console.error("Generate job failed:", generationId, error);
    const message =
      error instanceof Error
        ? error.message
        : "สร้างรูปไม่สำเร็จ กรุณาลองใหม่";

    await supabase
      .from("generations")
      .update({
        status: "failed",
        error_message: message,
      })
      .eq("id", generationId);
  }
}
