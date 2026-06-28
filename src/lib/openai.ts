import OpenAI, { toFile } from "openai";
import type { ShapeQuality } from "@/types/database";
import { extractTokenUsage } from "@/lib/cost";

const MODEL = "gpt-image-2";
const TIMEOUT_MS = 120_000;

function toUserFacingOpenAIError(error: unknown): Error {
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
      return new Error("OpenAI ใช้งานเกิน quota กรุณาลองใหม่ภายหลัง");
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
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: TIMEOUT_MS });
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (firstError) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      return await fn();
    } catch {
      throw toUserFacingOpenAIError(firstError);
    }
  }
}

export interface GenerateImageParams {
  prompt: string;
  width: number;
  height: number;
  quality: ShapeQuality;
  inputImageBuffer?: Buffer;
  inputImageMimeType?: string;
}

export async function generateImage(params: GenerateImageParams) {
  const openai = getOpenAIClient();
  const size = `${params.width}x${params.height}` as `${number}x${number}`;

  const result = await withRetry(async () => {
    if (params.inputImageBuffer) {
      const file = await toFile(
        params.inputImageBuffer,
        "input.png",
        { type: params.inputImageMimeType || "image/png" }
      );

      return openai.images.edit({
        model: MODEL,
        image: file,
        prompt: params.prompt,
        size,
        quality: params.quality,
      });
    }

    return openai.images.generate({
      model: MODEL,
      prompt: params.prompt,
      size,
      quality: params.quality,
    });
  });

  const imageData = result.data?.[0];
  if (!imageData?.b64_json) {
    throw new Error("ไม่ได้รับรูปภาพจาก OpenAI");
  }

  const usage = extractTokenUsage(result.usage);

  return {
    imageBuffer: Buffer.from(imageData.b64_json, "base64"),
    usage,
    model: MODEL,
  };
}
