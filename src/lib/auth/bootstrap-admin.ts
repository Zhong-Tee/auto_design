import { createAdminClient } from "@/lib/supabase/admin";

export async function ensureBootstrapAdmin(
  userId: string,
  email: string | undefined
): Promise<void> {
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (!bootstrapEmail || !email) return;

  if (email.trim().toLowerCase() !== bootstrapEmail) return;

  const admin = createAdminClient();

  const { count } = await admin
    .from("profiles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");

  if (count && count > 0) return;

  await admin.from("profiles").update({ role: "admin" }).eq("id", userId);
}
