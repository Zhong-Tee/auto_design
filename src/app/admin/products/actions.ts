"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

async function adminClient() {
  await requireAdmin();
  return createClient();
}

async function syncTextBoxConfigs(productId: string, count: number) {
  const supabase = await adminClient();
  const safeCount = Math.max(0, count);

  const { error: deleteError } = await supabase
    .from("text_box_configs")
    .delete()
    .eq("product_id", productId)
    .gt("position", safeCount);

  if (deleteError) throw new Error(deleteError.message);

  if (safeCount === 0) return;

  const { data: existing, error: fetchError } = await supabase
    .from("text_box_configs")
    .select("position")
    .eq("product_id", productId);

  if (fetchError) throw new Error(fetchError.message);

  const existingPositions = new Set(existing?.map((row) => row.position) ?? []);
  const toInsert = [];

  for (let position = 1; position <= safeCount; position++) {
    if (!existingPositions.has(position)) {
      toInsert.push({
        product_id: productId,
        position,
        label: null,
        placeholder: null,
        max_length: null,
      });
    }
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("text_box_configs")
      .insert(toInsert);
    if (insertError) throw new Error(insertError.message);
  }
}

export async function getProducts() {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function getProduct(id: string) {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("products")
    .select("*, text_box_configs(*)")
    .eq("id", id)
    .single();
  if (error) throw new Error(error.message);
  return data;
}

export async function saveProduct(formData: FormData) {
  const supabase = await adminClient();
  const id = formData.get("id") as string | null;
  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const text_box_count = Math.max(
    0,
    parseInt(formData.get("text_box_count") as string, 10) || 0
  );
  const is_active = formData.get("is_active") === "true";
  const image_urlRaw = formData.get("image_url") as string | null;
  const image_url =
    image_urlRaw === null
      ? undefined
      : image_urlRaw.trim() === ""
        ? null
        : image_urlRaw.trim();

  const payload = {
    name,
    description,
    text_box_count,
    is_active,
    ...(image_url !== undefined ? { image_url } : {}),
  };

  let productId = id;

  if (id) {
    const { error } = await supabase.from("products").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data: created, error } = await supabase
      .from("products")
      .insert(payload)
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "สร้างสินค้าไม่สำเร็จ");
    productId = created.id;
  }

  if (productId) {
    await syncTextBoxConfigs(productId, text_box_count);
  }

  revalidatePath("/admin/products");
  if (productId) revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
}

export async function updateProductImage(productId: string, imageUrl: string | null) {
  const supabase = await adminClient();
  const { error } = await supabase
    .from("products")
    .update({ image_url: imageUrl })
    .eq("id", productId);

  if (error) throw new Error(error.message);

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}`);
  revalidatePath("/");
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
  revalidatePath(`/admin/products/${product_id}`);
}

export async function deleteTextBoxConfig(id: string) {
  const supabase = await adminClient();
  const { data: config } = await supabase
    .from("text_box_configs")
    .select("product_id")
    .eq("id", id)
    .single();

  const { error } = await supabase.from("text_box_configs").delete().eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/admin/products");
  if (config?.product_id) {
    revalidatePath(`/admin/products/${config.product_id}`);
  }
}
