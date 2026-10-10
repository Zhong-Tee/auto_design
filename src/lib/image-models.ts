// โมเดล OpenAI ฝั่ง image generation ที่ใช้ผ่าน images.generate/images.edit
// จำกัดเฉพาะตระกูล gpt-image เพราะใช้พารามิเตอร์ quality (low/medium/high)
// และรายงาน token usage แบบเดียวกัน — DALL·E ใช้พารามิเตอร์คนละชุด
export const OPENAI_IMAGE_MODELS = [
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-flare",
  "gpt-image-2",
  "gpt-image-1",
  "gpt-image-1-mini",
] as const;

export type OpenAIImageModel = (typeof OPENAI_IMAGE_MODELS)[number];

// Standard Images API pricing in USD per 1M tokens, checked 2026-10-10.
// Source: https://developers.openai.com/api/docs/pricing
export const IMAGE_MODEL_PRICING: Partial<Record<OpenAIImageModel, {
  price_text_input_per_1m: number;
  price_image_input_per_1m: number;
  price_image_output_per_1m: number;
}>> = {
  "gpt-image-2.5-sunburst": {
    price_text_input_per_1m: 5,
    price_image_input_per_1m: 8,
    price_image_output_per_1m: 30,
  },
  "gpt-image-2.5-flare": {
    price_text_input_per_1m: 5,
    price_image_input_per_1m: 8,
    price_image_output_per_1m: 30,
  },
};

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
