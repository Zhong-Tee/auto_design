"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

async function adminClient() {
  await requireAdmin();
  return createClient();
}

export async function getPatterns() {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("patterns")
    .select("*, products(name)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getProductsForSelect() {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("products")
    .select("id, name, text_box_count")
    .order("name");
  return data ?? [];
}

export async function getPromptsForSelect() {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("prompts")
    .select("id, name, content")
    .order("name");
  return data ?? [];
}

export async function savePattern(formData: FormData) {
  const supabase = await adminClient();
  const id = formData.get("id") as string | null;
  const product_id = formData.get("product_id") as string;
  const name = formData.get("name") as string;
  const requires_image = formData.get("requires_image") === "true";
  const prompt_template = formData.get("prompt_template") as string;
  const thumbnail_url = (formData.get("thumbnail_url") as string) || null;
  const is_active = formData.get("is_active") === "true";

  const payload = {
    product_id,
    name,
    requires_image,
    prompt_template,
    thumbnail_url,
    is_active,
  };

  if (id) {
    const { error } = await supabase.from("patterns").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("patterns").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/patterns");
}

export async function deletePattern(id: string) {
  const supabase = await adminClient();
  const { error } = await supabase.from("patterns").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/patterns");
}
