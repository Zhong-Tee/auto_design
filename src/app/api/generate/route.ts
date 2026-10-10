import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fillPromptTemplate, fillNamedPlaceholders } from "@/lib/prompt";
import { getShapeSizeErrors } from "@/lib/shapes";
import {
  DEFAULT_GENERATION_HEIGHT,
  DEFAULT_GENERATION_QUALITY,
  DEFAULT_GENERATION_WIDTH,
} from "@/lib/shapes";
import { sanitizeOrderNumber } from "@/lib/order-filename";
import { resolveImageModel } from "@/lib/image-models";

const generateSchema = z
  .object({
    requestId: z.string().uuid(),
    productId: z.string().uuid().optional().nullable(),
    patternId: z.string().uuid().optional().nullable(),
    artStyleId: z.string().uuid().optional().nullable(),
    orderNumber: z.string().min(1).max(100),
    texts: z.array(z.string()),
    variables: z.record(z.string(), z.string()).optional().nullable(),
    uploadedImageUrl: z.string().url().optional().nullable(),
  })
  .refine((d) => d.artStyleId || (d.productId && d.patternId), {
    message: "ต้องเลือกสินค้าและรูปแบบ หรือ Art Style",
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

    const {
      requestId,
      productId,
      patternId,
      artStyleId,
      orderNumber,
      texts,
      variables,
      uploadedImageUrl,
    } = parsed.data;

    // A retried submission with the same id must return the same job, even after completion.
    const { data: existing, error: lookupError } = await supabase.from("generations")
      .select("id, status, order_number").eq("user_id", user.id).eq("request_id", requestId).maybeSingle();
    if (lookupError) {
      console.error("[queue] request lookup failed; check migration 012", lookupError);
      throw new Error("ระบบคิวยังไม่พร้อมใช้งาน กรุณาติดต่อผู้ดูแลระบบ");
    }
    if (existing) return NextResponse.json({ generationId: existing.id, status: existing.status, orderNumber: existing.order_number });

    const sanitizedOrder = sanitizeOrderNumber(orderNumber);
    if (!sanitizedOrder) {
      return NextResponse.json({ error: "กรุณากรอกเลขออเดอร์" }, { status: 400 });
    }

    const { data: activeDuplicate, error: duplicateError } = await supabase
      .from("generations")
      .select("id, request_id, status, order_number")
      .eq("user_id", user.id)
      .eq("order_number", sanitizedOrder)
      .in("status", ["pending", "processing"])
      .limit(1);
    if (duplicateError) throw new Error("ตรวจสอบเลขออเดอร์ไม่สำเร็จ กรุณาลองใหม่");

    if (activeDuplicate && activeDuplicate.length > 0) {
      const sameRequest = activeDuplicate.find((job) => job.request_id === requestId);
      if (sameRequest) return NextResponse.json({ generationId: sameRequest.id, status: sameRequest.status, orderNumber: sameRequest.order_number });
      return NextResponse.json(
        {
          error: `เลขออเดอร์ "${sanitizedOrder}" กำลังสร้างอยู่แล้ว กรุณาใช้เลขอื่นหรือรอให้เสร็จ`,
        },
        { status: 409 }
      );
    }

    let promptUsed: string;

    if (artStyleId) {
      const { data: artStyle } = await supabase
        .from("art_styles")
        .select("*")
        .eq("id", artStyleId)
        .eq("is_active", true)
        .single();

      if (!artStyle) {
        return NextResponse.json(
          { error: "ไม่พบ Art Style ที่เลือก" },
          { status: 400 }
        );
      }

      if (!uploadedImageUrl) {
        return NextResponse.json(
          { error: "กรุณาอัปโหลดรูปสำหรับ Art Style" },
          { status: 400 }
        );
      }

      promptUsed = fillNamedPlaceholders(
        artStyle.prompt_template,
        variables ?? {}
      );
    } else {
      const { data: pattern } = await supabase
        .from("patterns")
        .select("*")
        .eq("id", patternId!)
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

      promptUsed = fillPromptTemplate(pattern.prompt_template, texts);
    }

    const shapeSizeErrors = getShapeSizeErrors(
      DEFAULT_GENERATION_WIDTH,
      DEFAULT_GENERATION_HEIGHT
    );
    if (shapeSizeErrors.length > 0) {
      return NextResponse.json({ error: shapeSizeErrors[0] }, { status: 400 });
    }

    const { data: modelRows, error: modelError } = await supabase
      .from("app_settings")
      .select("key, value")
      .eq("key", "openai_image_model");
    if (modelError) throw new Error("โหลดการตั้งค่าสร้างภาพไม่สำเร็จ กรุณาลองใหม่");

    const size = `${DEFAULT_GENERATION_WIDTH}x${DEFAULT_GENERATION_HEIGHT}`;

    const { data: generation, error: insertError } = await supabase
      .from("generations")
      .insert({
        request_id: requestId,
        user_id: user.id,
        product_id: productId ?? null,
        pattern_id: patternId ?? null,
        art_style_id: artStyleId ?? null,
        shape_id: null,
        input_text: artStyleId
          ? (variables ?? {})
          : Object.fromEntries(texts.map((t, i) => [`text${i + 1}`, t])),
        uploaded_image_url: uploadedImageUrl ?? null,
        prompt_used: promptUsed,
        model: resolveImageModel(modelRows ?? []),
        quality: DEFAULT_GENERATION_QUALITY,
        size,
        order_number: sanitizedOrder,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !generation) {
      if (insertError?.code === "23505") {
        const { data: duplicate } = await supabase.from("generations").select("id, status, order_number")
          .eq("user_id", user.id).eq("request_id", requestId).maybeSingle();
        if (duplicate) return NextResponse.json({ generationId: duplicate.id, status: duplicate.status, orderNumber: duplicate.order_number });
        return NextResponse.json({ error: "เลขออเดอร์นี้มีงานที่ยังไม่เสร็จ กรุณารอหรือยกเลิกงานเดิม" }, { status: 409 });
      }
      return NextResponse.json(
        { error: "ไม่สามารถบันทึกการสร้างรูปได้" },
        { status: 500 }
      );
    }

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
