"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";

async function adminClient() {
  await requireAdmin();
  return createClient();
}

export async function getArtStyles() {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("art_styles")
    .select("*")
    .order("sort_order");
  if (error) throw new Error(error.message);
  return data;
}

export async function getPromptsForSelect() {
  const supabase = await adminClient();
  const { data } = await supabase
    .from("prompts")
    .select("id, name, content")
    .order("name");
  return data ?? [];
}

export async function saveArtStyle(formData: FormData) {
  const supabase = await adminClient();
  const id = formData.get("id") as string | null;
  const name = formData.get("name") as string;
  const prompt_template = formData.get("prompt_template") as string;
  const thumbnail_url = (formData.get("thumbnail_url") as string) || null;

  const payload = { name, prompt_template, thumbnail_url };

  if (id) {
    const { error } = await supabase
      .from("art_styles")
      .update(payload)
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { data: maxRow } = await supabase
      .from("art_styles")
      .select("sort_order")
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("art_styles").insert({
      ...payload,
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/art-styles");
  revalidatePath("/kids");
}

export async function reorderArtStyle(id: string, direction: "up" | "down") {
  const supabase = await adminClient();

  const { data: current, error: currentError } = await supabase
    .from("art_styles")
    .select("id, sort_order")
    .eq("id", id)
    .single();

  if (currentError || !current) {
    throw new Error("ไม่พบ Art Style");
  }

  let neighborQuery = supabase.from("art_styles").select("id, sort_order");

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
    .from("art_styles")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", current.id);

  if (updateCurrentError) throw new Error(updateCurrentError.message);

  const { error: updateNeighborError } = await supabase
    .from("art_styles")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbor.id);

  if (updateNeighborError) throw new Error(updateNeighborError.message);

  revalidatePath("/admin/art-styles");
  revalidatePath("/kids");
}

export async function deleteArtStyle(id: string) {
  const supabase = await adminClient();
  const { error } = await supabase.from("art_styles").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/art-styles");
  revalidatePath("/kids");
}
