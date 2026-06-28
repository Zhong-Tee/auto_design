"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { assertValidShapeSize } from "@/lib/shapes";

async function adminClient() {
  await requireAdmin();
  return createClient();
}

export async function getShapes() {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("shapes")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function saveShape(formData: FormData) {
  const supabase = await adminClient();
  const id = formData.get("id") as string | null;
  const name = formData.get("name") as string;
  const width_px = parseInt(formData.get("width_px") as string, 10);
  const height_px = parseInt(formData.get("height_px") as string, 10);
  const quality = formData.get("quality") as "low" | "medium" | "high";
  const is_active = formData.get("is_active") === "true";

  assertValidShapeSize(width_px, height_px);

  const payload = { name, width_px, height_px, quality, is_active };

  if (id) {
    const { error } = await supabase.from("shapes").update(payload).eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("shapes").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/shapes");
}

export async function deleteShape(id: string) {
  const supabase = await adminClient();
  const { error } = await supabase.from("shapes").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/shapes");
}
