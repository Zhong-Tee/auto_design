"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin, getCurrentProfile } from "@/lib/auth/session";

async function adminClient() {
  await requireAdmin();
  return createClient();
}

export async function getPrompts() {
  const supabase = await adminClient();
  const { data, error } = await supabase
    .from("prompts")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
}

export async function savePrompt(formData: FormData) {
  const supabase = await adminClient();
  const profile = await getCurrentProfile();
  const id = formData.get("id") as string | null;
  const name = formData.get("name") as string;
  const content = formData.get("content") as string;
  const tagsRaw = (formData.get("tags") as string) || "";
  const tags = tagsRaw
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  if (id) {
    const { error } = await supabase
      .from("prompts")
      .update({ name, content, tags })
      .eq("id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("prompts").insert({
      name,
      content,
      tags,
      created_by: profile?.id ?? null,
    });
    if (error) throw new Error(error.message);
  }

  revalidatePath("/admin/prompts");
}

export async function deletePrompt(id: string) {
  const supabase = await adminClient();
  const { error } = await supabase.from("prompts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/prompts");
}
