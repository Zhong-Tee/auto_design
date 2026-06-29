import { after, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildOutputFileName } from "@/lib/order-filename";
import { kickGenerationQueue } from "@/lib/generation-queue";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: generation, error } = await supabase
    .from("generations")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !generation) {
    return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  }

  if (generation.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const orderNumber = generation.order_number ?? "";
  const outputFileName = orderNumber
    ? buildOutputFileName(orderNumber)
    : "output.png";

  if (generation.status === "pending" || generation.status === "processing") {
    const createdAt = new Date(generation.created_at).getTime();
    const ageMs = Date.now() - createdAt;
    if (ageMs > 30_000) {
      after(async () => {
        await kickGenerationQueue();
      });
    }

    return NextResponse.json({
      generationId: generation.id,
      status: "pending",
      orderNumber,
    });
  }

  if (generation.status === "failed") {
    return NextResponse.json({
      generationId: generation.id,
      status: "failed",
      orderNumber,
      error: generation.error_message ?? "สร้างรูปไม่สำเร็จ",
    });
  }

  return NextResponse.json({
    generationId: generation.id,
    status: "success",
    orderNumber,
    outputImageUrl: generation.output_image_url,
    outputFileName,
    promptUsed: generation.prompt_used,
    model: generation.model,
    usage: {
      input_text_tokens: generation.input_text_tokens,
      input_image_tokens: generation.input_image_tokens,
      output_image_tokens: generation.output_image_tokens,
      total_tokens: generation.total_tokens,
    },
    costUsd: generation.cost_usd,
    costThb: generation.cost_thb,
    costThbDisplay: generation.cost_thb.toFixed(2),
  });
}
