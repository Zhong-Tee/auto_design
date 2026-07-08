"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { buildPricingSettings } from "@/lib/cost";
import { isOpenAIImageModel, resolveImageModel } from "@/lib/image-models";

async function adminClient() {
  await requireAdmin();
  return createClient();
}

export async function getSettings() {
  const supabase = await adminClient();
  const { data, error } = await supabase.from("app_settings").select("*");
  if (error) throw new Error(error.message);
  return {
    pricing: buildPricingSettings(data ?? []),
    imageModel: resolveImageModel(data ?? []),
  };
}

export async function saveSettings(formData: FormData) {
  const supabase = await adminClient();
  const keys = [
    "usd_to_thb",
    "price_text_input_per_1m",
    "price_image_input_per_1m",
    "price_image_output_per_1m",
  ] as const;

  for (const key of keys) {
    const raw = formData.get(key) as string;
    const value = parseFloat(raw);
    if (Number.isNaN(value)) continue;

    const { error } = await supabase
      .from("app_settings")
      .upsert({ key, value: String(value), updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }

  const model = formData.get("openai_image_model");
  if (isOpenAIImageModel(model)) {
    const { error } = await supabase.from("app_settings").upsert({
      key: "openai_image_model",
      value: model,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/settings");
}
