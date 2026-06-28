"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

async function adminClient() {
  await requireAdmin();
  return createClient();
}

export async function getProducts() {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, text_box_configs(*)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveProduct(formData: FormData) {
  const supabase = await adminClient();
  const id = formData.get("id") as string | null;
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const text_box_count = parseInt(formData.get("text_box_count") as string, 10) || 1;
  const is_active = formData.get("is_active") === "true";

  const payload = { name, description, text_box_count, is_active };

  if (id) {
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("products").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/products");
}

export async function deleteProduct(id: string) {
  const supabase = await adminClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}

export async function saveTextBoxConfig(formData: FormData) {
  const supabase = await adminClient();
  const id = formData.get("id") as string | null;
  const product_id = formData.get("product_id") as string;
  const position = parseInt(formData.get("position") as string, 10);
  const label = (formData.get("label") as string) || null;
  const placeholder = (formData.get("placeholder") as string) || null;
  const max_lengthRaw = formData.get("max_length") as string;
  const max_length = max_lengthRaw ? parseInt(max_lengthRaw, 10) : null;

  const payload = { product_id, position, label, placeholder, max_length };

  if (id) {
    const { error } = await supabase.from("text_box_configs").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("text_box_configs").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/products");
}

export async function deleteTextBoxConfig(id: string) {
  const supabase = await adminClient();
  const { error } = await supabase.from("text_box_configs").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/products");
}
