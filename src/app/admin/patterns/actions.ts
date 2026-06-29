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
    .order("product_id")
    .order("sort_order");
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
    const { data: maxRow } = await supabase
      .from("patterns")
      .select("sort_order")
      .eq("product_id", product_id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("patterns").insert({
      ...payload,
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/patterns");
}

export async function reorderPattern(id: string, direction: "up" | "down") {
  const supabase = await adminClient();

  const { data: current, error: currentError } = await supabase
    .from("patterns")
    .select("id, product_id, sort_order")
    .eq("id", id)
    .single();

  if (currentError || !current) {
    throw new Error("ไม่พบรูปแบบ");
  }

  let neighborQuery = supabase
    .from("patterns")
    .select("id, sort_order")
    .eq("product_id", current.product_id);

  neighborQuery =
    direction === "up"
      ? neighborQuery.lt("sort_order", current.sort_order)
      : neighborQuery.gt("sort_order", current.sort_order);

  const { data: neighbor, error: neighborError } = await neighborQuery
    .order("sort_order", { ascending: direction === "up" ? false : true })
    .limit(1)
    .maybeSingle();

  if (neighborError) throw new Error(neighborError.message);
  if (!neighbor) return;

  const { error: updateCurrentError } = await supabase
    .from("patterns")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", current.id);

  if (updateCurrentError) throw new Error(updateCurrentError.message);

  const { error: updateNeighborError } = await supabase
    .from("patterns")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbor.id);

  if (updateNeighborError) throw new Error(updateNeighborError.message);

  revalidatePath("/admin/patterns");
  revalidatePath("/");
}

export async function deletePattern(id: string) {
  const supabase = await adminClient();
  const { error } = await supabase.from("patterns").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/patterns");
}
