import type { PricingSettings, TokenUsage } from "@/types/database";

export function parseSettingNumber(value: unknown, fallback: number): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = parseFloat(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }
  return fallback;
}

export function buildPricingSettings(
  rows: { key: string; value: unknown }[]
): PricingSettings {
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    usd_to_thb: parseSettingNumber(
      map.usd_to_thb,
      parseFloat(process.env.DEFAULT_USD_TO_THB || "35")
    ),
    price_text_input_per_1m: parseSettingNumber(map.price_text_input_per_1m, 5),
    price_image_input_per_1m: parseSettingNumber(map.price_image_input_per_1m, 10),
    price_image_output_per_1m: parseSettingNumber(map.price_image_output_per_1m, 8),
  };
}

export function calculateCost(
  usage: TokenUsage,
  pricing: PricingSettings
): { costUsd: number; costThb: number; costThbDisplay: string } {
  const costUsd =
    (usage.input_text_tokens / 1_000_000) * pricing.price_text_input_per_1m +
    (usage.input_image_tokens / 1_000_000) * pricing.price_image_input_per_1m +
    (usage.output_image_tokens / 1_000_000) * pricing.price_image_output_per_1m;

  const costThb = costUsd * pricing.usd_to_thb;

  return {
    costUsd,
    costThb,
    costThbDisplay: costThb.toFixed(2),
  };
}

export function extractTokenUsage(usage: unknown): TokenUsage {
  const u = usage as Record<string, unknown> | undefined;
  if (!u) {
    return {
      input_text_tokens: 0,
      input_image_tokens: 0,
      output_image_tokens: 0,
      total_tokens: 0,
    };
  }

  const details = u.input_tokens_details as Record<string, number> | undefined;
  const inputText = details?.text_tokens ?? (u.input_tokens as number) ?? 0;
  const inputImage = details?.image_tokens ?? 0;
  const outputImage = (u.output_tokens as number) ?? 0;
  const total = (u.total_tokens as number) ?? inputText + inputImage + outputImage;

  if (!details?.text_tokens && !details?.image_tokens && u.input_tokens) {
    console.warn("[cost] OpenAI usage missing text/image token breakdown");
  }

  return {
    input_text_tokens: inputText,
    input_image_tokens: inputImage,
    output_image_tokens: outputImage,
    total_tokens: total,
  };
}
