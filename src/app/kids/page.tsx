import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth/session";
import { formatProfileLabel } from "@/lib/profile";
import { KidsForm } from "./kids-form";

export default async function KidsPage() {
  const supabase = await createClient();
  const [stylesRes, profile] = await Promise.all([
    supabase
      .from("art_styles")
      .select("*")
      .eq("is_active", true)
      .order("sort_order"),
    getCurrentProfile(),
  ]);

  return (
    <KidsForm
      initialArtStyles={stylesRes.data ?? []}
      userName={formatProfileLabel(profile)}
    />
  );
}
