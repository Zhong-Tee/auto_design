import { after, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fillPromptTemplate } from "@/lib/prompt";
import { getShapeSizeErrors } from "@/lib/shapes";
import {
  DEFAULT_GENERATION_HEIGHT,
  DEFAULT_GENERATION_QUALITY,
  DEFAULT_GENERATION_WIDTH,
} from "@/lib/shapes";
import { sanitizeOrderNumber } from "@/lib/order-filename";
import { processGenerationJob } from "@/lib/process-generation";

const generateSchema = z.object({
  productId: z.string().uuid(),
  patternId: z.string().uuid(),
  orderNumber: z.string().min(1).max(100),
  texts: z.array(z.string()),
  uploadedImageUrl: z.string().url().optional().nullable(),
});

export async function POST(request: Request) {
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

    const { productId, patternId, orderNumber, texts, uploadedImageUrl } =
      parsed.data;

    const sanitizedOrder = sanitizeOrderNumber(orderNumber);
    if (!sanitizedOrder) {
      return NextResponse.json({ error: "กรุณากรอกเลขออเดอร์" }, { status: 400 });
    }

    const { data: pattern } = await supabase
      .from("patterns")
      .select("*")
      .eq("id", patternId)
      .eq("is_active", true)
      .single();

    if (!pattern) {
      return NextResponse.json(
        { error: "ไม่พบรูปแบบที่เลือก" },
        { status: 400 }
      );
    }

    if (pattern.requires_image && !uploadedImageUrl) {
      return NextResponse.json(
        { error: "รูปแบบนี้ต้องอัปโหลดรูปคน" },
        { status: 400 }
      );
    }

    const shapeSizeErrors = getShapeSizeErrors(
      DEFAULT_GENERATION_WIDTH,
      DEFAULT_GENERATION_HEIGHT
    );
    if (shapeSizeErrors.length > 0) {
      return NextResponse.json({ error: shapeSizeErrors[0] }, { status: 400 });
    }

    const promptUsed = fillPromptTemplate(pattern.prompt_template, texts);
    const size = `${DEFAULT_GENERATION_WIDTH}x${DEFAULT_GENERATION_HEIGHT}`;

    const { data: generation, error: insertError } = await supabase
      .from("generations")
      .insert({
        user_id: user.id,
        product_id: productId,
        pattern_id: patternId,
        shape_id: null,
        input_text: Object.fromEntries(
          texts.map((t, i) => [`text${i + 1}`, t])
        ),
        uploaded_image_url: uploadedImageUrl ?? null,
        prompt_used: promptUsed,
        model: "gpt-image-2",
        quality: DEFAULT_GENERATION_QUALITY,
        size,
        order_number: sanitizedOrder,
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

    after(async () => {
      await processGenerationJob(generation.id);
    });

    return NextResponse.json({
      generationId: generation.id,
      status: "pending",
      orderNumber: sanitizedOrder,
    });
  } catch (error) {
    console.error("Generate enqueue failed:", error);
    const message =
      error instanceof Error
        ? error.message
        : "สร้างรูปไม่สำเร็จ กรุณาลองใหม่";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
