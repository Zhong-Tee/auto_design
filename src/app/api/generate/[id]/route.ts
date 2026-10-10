import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildOutputFileName } from "@/lib/order-filename";
import { createAdminClient } from "@/lib/supabase/admin";

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

  const progress = {
    createdAt: generation.created_at,
    processingStartedAt: generation.processing_started_at,
    completedAt: generation.completed_at,
    step: generation.processing_step,
    attemptCount: generation.attempt_count,
    heartbeatAt: generation.heartbeat_at,
    warning: generation.status === "processing" &&
      Date.now() - new Date(generation.heartbeat_at ?? generation.processing_started_at ?? generation.created_at).getTime() > 90_000
      ? "ขาดการติดต่อกับตัวประมวลผล กรุณารอการตรวจสอบหรือยกเลิกงาน" :
      generation.status === "pending" && Date.now() - new Date(generation.created_at).getTime() > 60_000
      ? "ยังรอคิว หากไม่มีงานอื่นกำลังสร้าง กรุณาตรวจสอบว่า Worker เปิดอยู่" : undefined,
  };

  if (generation.status === "pending" || generation.status === "processing") {
    return NextResponse.json({
      ...progress,
      generationId: generation.id,
      status: generation.status,
      orderNumber,
    });
  }

  if (generation.status === "failed" || generation.status === "cancelled") {
    return NextResponse.json({
      ...progress,
      generationId: generation.id,
      status: generation.status,
      orderNumber,
      error: generation.error_message ?? "สร้างรูปไม่สำเร็จ",
    });
  }

  return NextResponse.json({
    ...progress,
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
    processingMs: generation.processing_duration_ms ?? undefined,
  });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: job, error } = await supabase.from("generations").select("id, user_id, status").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: "ตรวจสอบงานไม่สำเร็จ" }, { status: 503 });
  if (!job) return NextResponse.json({ error: "ไม่พบรายการ" }, { status: 404 });
  if (job.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { data: cancelled, error: cancelError } = await createAdminClient().from("generations").update({
    status: "cancelled", processing_step: "cancelled", worker_token: null,
    completed_at: new Date().toISOString(), error_message: "ยกเลิกโดยผู้ใช้",
  }).eq("id", id).eq("user_id", user.id).in("status", ["pending", "processing"])
    .select("id, completed_at").maybeSingle();
  if (cancelError) return NextResponse.json({ error: "ยกเลิกไม่สำเร็จ กรุณาลองใหม่" }, { status: 503 });
  if (!cancelled) return NextResponse.json({ error: "งานสิ้นสุดแล้ว กรุณาตรวจสอบสถานะล่าสุด" }, { status: 409 });
  return NextResponse.json({ generationId: id, status: "cancelled", completedAt: cancelled.completed_at });
}
