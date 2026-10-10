import OpenAI, { toFile } from "openai";
import type { ShapeQuality } from "@/types/database";
import { extractTokenUsage } from "@/lib/cost";
import { DEFAULT_IMAGE_MODEL } from "@/lib/image-models";
import {
  assertTransparentPng,
  resolveImageBackground,
  type ImageBackground,
} from "@/lib/image-background";

const TIMEOUT_MS = 600_000;

function toUserFacingOpenAIError(error: unknown): Error {
  if (error instanceof Error && error.constructor.name === "APIConnectionTimeoutError") {
    return new Error("หมดเวลารอผล AI หลัง 10 นาที คำขออาจยังประมวลผลอยู่ กรุณาตรวจสอบก่อนสร้างใหม่");
  }
  if (error && typeof error === "object" && "status" in error) {
    const apiError = error as {
      status?: number;
      message?: string;
      error?: { message?: string };
    };
    const detail = apiError.error?.message ?? apiError.message ?? "";

    if (apiError.status === 401) {
      return new Error(
        "OpenAI API key ไม่ถูกต้อง กรุณาตรวจสอบ OPENAI_API_KEY ใน .env.local"
      );
    }
    if (apiError.status === 429) {
      return new Error("AI จำกัดจำนวนคำขอหรือโควตา กรุณาลองใหม่ภายหลัง");
    }
    if (detail.toLowerCase().includes("minimum pixel budget")) {
      return new Error(
        "ขนาดรูปเล็กเกินไป — พิกเซลรวมต้องอย่างน้อย 655,360 (เช่น 576×1152 หรือ 1024×1024)"
      );
    }
    if (detail && !detail.toLowerCase().includes("api key")) {
      return new Error(detail);
    }
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error("สร้างรูปไม่สำเร็จ กรุณาลองใหม่");
}

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured");
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: TIMEOUT_MS, maxRetries: 0 });
}

async function withRetry<T>(
  fn: () => Promise<T>,
  params: GenerateImageParams
): Promise<T> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    params.signal?.throwIfAborted();
    await params.onAttempt?.(attempt);
    try {
      return await fn();
    } catch (error) {
      const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
      const requestId = error && typeof error === "object" && "request_id" in error ? error.request_id : undefined;
      console.info(`[generate-api] attempt=${attempt} status=${status ?? "connection"} request_id=${requestId ?? "unavailable"}`);
      // Only replay explicit transient HTTP rejections. A timeout has an unknown outcome.
      if (attempt === 2 || ![429, 503].includes(status as number) || params.signal?.aborted) {
        throw toUserFacingOpenAIError(error);
      }
      const headers = "headers" in (error as object) ? (error as { headers?: Headers }).headers : undefined;
      const retryAfter = headers?.get("retry-after");
      const retryAfterMs = headers?.get("retry-after-ms");
      let waitMs = 5000;
      if (retryAfterMs && Number.isFinite(Number(retryAfterMs))) waitMs = Math.max(waitMs, Number(retryAfterMs));
      else if (retryAfter) {
        const requested = Number.isFinite(Number(retryAfter))
          ? Number(retryAfter) * 1000 : Date.parse(retryAfter) - Date.now();
        if (Number.isFinite(requested)) waitMs = Math.max(waitMs, requested);
      }
      // Do not retry earlier than requested, or wait indefinitely inside the worker.
      if (waitMs > 60_000) throw toUserFacingOpenAIError(error);
      await params.onRetry?.(attempt);
      await new Promise<void>((resolve, reject) => {
        const signal = params.signal;
        const abort = () => { clearTimeout(timer); reject(signal?.reason); };
        const timer = setTimeout(() => { signal?.removeEventListener("abort", abort); resolve(); }, waitMs);
        signal?.addEventListener("abort", abort, { once: true });
        if (signal?.aborted) abort();
      });
    }
  }
  throw new Error("สร้างรูปไม่สำเร็จ");
}

export interface GenerateImageParams {
  prompt: string;
  width: number;
  height: number;
  quality: ShapeQuality;
  model?: string;
  background?: ImageBackground;
  inputImageBuffer?: Buffer;
  inputImageMimeType?: string;
  signal?: AbortSignal;
  onAttempt?: (attempt: number) => Promise<void>;
  onRetry?: (attempt: number) => Promise<void>;
}

export async function generateImage(params: GenerateImageParams) {
  const openai = getOpenAIClient();
  const size = `${params.width}x${params.height}` as `${number}x${number}`;
  const model = params.model || DEFAULT_IMAGE_MODEL;
  const background = params.background ?? resolveImageBackground(params.prompt);

  const result = await withRetry(async () => {
    if (params.inputImageBuffer) {
      const file = await toFile(
        params.inputImageBuffer,
        "input.png",
        { type: params.inputImageMimeType || "image/png" }
      );

      return openai.images.edit({
        model,
        image: file,
        prompt: params.prompt,
        size,
        quality: params.quality,
        background,
        output_format: "png",
      }, { signal: params.signal });
    }

    return openai.images.generate({
      model,
      prompt: params.prompt,
      size,
      quality: params.quality,
      background,
      output_format: "png",
    }, { signal: params.signal });
  }, params);

  const imageData = result.data?.[0];
  if (!imageData?.b64_json) {
    throw new Error("ไม่ได้รับรูปภาพจาก OpenAI");
  }

  const usage = extractTokenUsage(result.usage);
  const imageBuffer = Buffer.from(imageData.b64_json, "base64");
  if (background === "transparent") {
    await assertTransparentPng(imageBuffer);
  }

  return {
    imageBuffer,
    usage,
    model,
  };
}
