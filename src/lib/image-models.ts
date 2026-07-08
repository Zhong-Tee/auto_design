// โมเดล OpenAI ฝั่ง image generation ที่ใช้ผ่าน images.generate/images.edit
// จำกัดเฉพาะตระกูล gpt-image เพราะใช้พารามิเตอร์ quality (low/medium/high)
// และรายงาน token usage แบบเดียวกัน — DALL·E ใช้พารามิเตอร์คนละชุด
export const OPENAI_IMAGE_MODELS = [
  "gpt-image-2",
  "gpt-image-1",
  "gpt-image-1-mini",
] as const;

export type OpenAIImageModel = (typeof OPENAI_IMAGE_MODELS)[number];

export const DEFAULT_IMAGE_MODEL: OpenAIImageModel = "gpt-image-2";

export function isOpenAIImageModel(value: unknown): value is OpenAIImageModel {
  return (
    typeof value === "string" &&
    (OPENAI_IMAGE_MODELS as readonly string[]).includes(value)
  );
}

export function resolveImageModel(
  rows: { key: string; value: unknown }[]
): OpenAIImageModel {
  const raw = rows.find((r) => r.key === "openai_image_model")?.value;
  return isOpenAIImageModel(raw) ? raw : DEFAULT_IMAGE_MODEL;
}
