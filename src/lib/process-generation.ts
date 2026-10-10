import { generateImage } from "@/lib/openai";
import { fetchImageFromUrl, uploadImage } from "@/lib/storage";
import { buildPricingSettings, calculateCost } from "@/lib/cost";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Generation, ShapeQuality } from "@/types/database";

const JOB_DEADLINE_MS = 25 * 60 * 1000;

/** A claimed job carries an immutable lease token. All writes are fenced by it. */
export async function processGenerationJob(generation: Generation): Promise<void> {
  const supabase = createAdminClient();
  const id = generation.id;
  const token = generation.worker_token;
  if (!token) throw new Error("งานไม่มี worker token กรุณารัน migration 012");
  const controller = new AbortController();
  const { signal } = controller;
  const startedAt = Date.now();
  let heartbeatBusy = false;

  async function updateOwned(payload: Record<string, unknown>) {
    const { data, error } = await supabase.from("generations").update(payload)
      .eq("id", id).eq("worker_token", token).eq("status", "processing")
      .select("id").maybeSingle();
    if (error) throw new Error(`บันทึกสถานะงานไม่สำเร็จ: ${error.message}`);
    if (!data) {
      controller.abort(new Error("งานถูกยกเลิกหรือสิทธิ์ประมวลผลสิ้นสุดแล้ว"));
      signal.throwIfAborted();
    }
  }

  async function progress(step: string, extra: Record<string, unknown> = {}) {
    signal.throwIfAborted();
    await updateOwned({ processing_step: step, heartbeat_at: new Date().toISOString(), ...extra });
    console.info(`[generate] ${id} order=${generation.order_number} step=${step}`);
  }

  const heartbeat = setInterval(async () => {
    if (heartbeatBusy || signal.aborted) return;
    heartbeatBusy = true;
    try {
      await updateOwned({ heartbeat_at: new Date().toISOString() });
    } catch (error) {
      // Fail closed: never continue a paid request while ownership is uncertain.
      controller.abort(error);
      console.error(`[generate] ${id} heartbeat failed`, error);
    } finally { heartbeatBusy = false; }
  }, 15_000);
  const deadline = setTimeout(() => controller.abort(new Error(
    "งานเกินเวลาสูงสุด 25 นาที ผลจาก AI อาจยังไม่แน่นอน กรุณาตรวจสอบก่อนสร้างใหม่"
  )), JOB_DEADLINE_MS);

  console.info(`[generate] start ${id} order=${generation.order_number} token=${token}`);
  try {
    const { data: settingsRows, error: settingsError } = await supabase.from("app_settings").select("key, value");
    if (settingsError) throw settingsError;
    if (!generation.prompt_used) throw new Error("ไม่พบคำสั่งที่บันทึกไว้สำหรับงานนี้");

    await progress("loading");
    const inputImageBuffer = generation.uploaded_image_url
      ? await fetchImageFromUrl(generation.uploaded_image_url, signal) : undefined;
    const [width, height] = (generation.size ?? "1024x1024").split("x").map(Number);
    const apiStartedAt = Date.now();
    const { imageBuffer, usage, model } = await generateImage({
      prompt: generation.prompt_used, width, height,
      quality: (generation.quality ?? "medium") as ShapeQuality,
      model: generation.model, inputImageBuffer, inputImageMimeType: "image/png", signal,
      onAttempt: (attempt) => progress("generating", { attempt_count: attempt }),
      onRetry: () => progress("retrying"),
    });
    const processingDurationMs = Date.now() - apiStartedAt;
    await progress("saving");
    // Each lease writes a different object. An abandoned worker cannot overwrite a new image.
    const key = `outputs/${generation.user_id}/${id}/${token}.png`;
    const outputImageUrl = await uploadImage(key, imageBuffer, "image/png", { signal });
    signal.throwIfAborted();
    const { costUsd, costThb } = calculateCost(usage, buildPricingSettings(settingsRows ?? []));
    await updateOwned({
      output_image_url: outputImageUrl, model,
      input_text_tokens: usage.input_text_tokens, input_image_tokens: usage.input_image_tokens,
      output_image_tokens: usage.output_image_tokens, total_tokens: usage.total_tokens,
      cost_usd: costUsd, cost_thb: costThb, processing_duration_ms: processingDurationMs,
      status: "success", processing_step: "completed", completed_at: new Date().toISOString(),
      worker_token: null, error_message: null,
    });
    console.info(`[generate] success ${id} total_ms=${Date.now() - startedAt} api_ms=${processingDurationMs}`);
  } catch (error) {
    const reason = signal.aborted ? signal.reason : error;
    const message = reason instanceof Error ? reason.message : "สร้างรูปไม่สำเร็จ";
    console.error(`[generate] failed ${id} total_ms=${Date.now() - startedAt}`, reason);
    const { error: persistError } = await supabase.from("generations").update({
      status: "failed", error_message: message, processing_step: "failed",
      completed_at: new Date().toISOString(), worker_token: null,
    }).eq("id", id).eq("worker_token", token).eq("status", "processing");
    if (persistError) console.error(`[generate] ${id} could not persist failure`, persistError);
  } finally {
    clearInterval(heartbeat);
    clearTimeout(deadline);
  }
}
