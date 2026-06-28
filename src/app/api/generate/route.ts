import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fillPromptTemplate } from "@/lib/prompt";
import { generateImage } from "@/lib/openai";
import {
  buildOutputKey,
  fetchImageFromUrl,
  uploadImage,
} from "@/lib/storage";
import { buildPricingSettings, calculateCost } from "@/lib/cost";

const generateSchema = z.object({
  productId: z.string().uuid(),
  patternId: z.string().uuid(),
  shapeId: z.string().uuid(),
  texts: z.array(z.string()),
  uploadedImageUrl: z.string().url().optional().nullable(),
});

export async function POST(request: Request) {
  let generationId: string | null = null;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = generateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "ข้อมูลไม่ถูกต้อง" }, { status: 400 });
    }

    const { productId, patternId, shapeId, texts, uploadedImageUrl } =
      parsed.data;

    const [{ data: pattern }, { data: shape }, { data: settingsRows }] =
      await Promise.all([
        supabase
          .from("patterns")
          .select("*")
          .eq("id", patternId)
          .eq("is_active", true)
          .single(),
        supabase
          .from("shapes")
          .select("*")
          .eq("id", shapeId)
          .eq("is_active", true)
          .single(),
        supabase.from("app_settings").select("key, value"),
      ]);

    if (!pattern || !shape) {
      return NextResponse.json(
        { error: "ไม่พบรูปแบบหรือรูปทรงที่เลือก" },
        { status: 400 }
      );
    }

    if (pattern.requires_image && !uploadedImageUrl) {
      return NextResponse.json(
        { error: "รูปแบบนี้ต้องอัปโหลดรูปคน" },
        { status: 400 }
      );
    }

    const promptUsed = fillPromptTemplate(pattern.prompt_template, texts);
    const size = `${shape.width_px}x${shape.height_px}`;

    const { data: generation, error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        product_id: productId,
        pattern_id: patternId,
        shape_id: shapeId,
        input_text: Object.fromEntries(
          texts.map((t, i) => [`text${i + 1}`, t])
        ),
        uploaded_image_url: uploadedImageUrl ?? null,
        prompt_used: promptUsed,
        model: "gpt-image-2",
        quality: shape.quality,
        size,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !generation) {
      return NextResponse.json(
        { error: "ไม่สามารถบันทึกการสร้างรูปได้" },
        { status: 500 }
      );
    }

    generationId = generation.id;

    let inputImageBuffer: Buffer | undefined;
    if (pattern.requires_image && uploadedImageUrl) {
      inputImageBuffer = await fetchImageFromUrl(uploadedImageUrl);
    }

    const { imageBuffer, usage, model } = await generateImage({
      prompt: promptUsed,
      width: shape.width_px,
      height: shape.height_px,
      quality: shape.quality,
      inputImageBuffer,
      inputImageMimeType: "image/png",
    });

    const outputKey = buildOutputKey(user.id);
    const outputImageUrl = await uploadImage(
      outputKey,
      imageBuffer,
      "image/png"
    );

    const pricing = buildPricingSettings(settingsRows ?? []);
    const { costUsd, costThb, costThbDisplay } = calculateCost(usage, pricing);

    const { error: updateError } = await supabase
      .from("generations")
      .update({
        output_image_url: outputImageUrl,
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
      return NextResponse.json(
        { error: "สร้างรูปสำเร็จแต่บันทึกไม่ครบ กรุณาตรวจประวัติ" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      generationId,
      outputImageUrl,
      promptUsed,
      model,
      usage,
      costUsd,
      costThb,
      costThbDisplay,
    });
  } catch (error) {
    console.error("Generate failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "สร้างรูปไม่สำเร็จ กรุณาลองใหม่";

    if (generationId) {
      const supabase = await createClient();
      await supabase
        .from("generations")
        .update({
          status: "failed",
          error_message: message,
        })
        .eq("id", generationId);
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
