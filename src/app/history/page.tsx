import { createClient } from "@/lib/supabase/server";
import { formatProfileLabel } from "@/lib/profile";
import type { Generation, Profile } from "@/types/database";
import { HistoryPanel } from "./history-panel";

export default async function HistoryPage() {
  const supabase = await createClient();
  const [{ data: generations }, { data: profiles }] = await Promise.all([
    supabase
      .from("generations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("id, email, display_name"),
  ]);

  const items = (generations ?? []) as Generation[];
  const profileLabels = Object.fromEntries(
    ((profiles ?? []) as Pick<Profile, "id" | "email" | "display_name">[]).map(
      (profile) => [profile.id, formatProfileLabel(profile)] as const
    )
  );

  return <HistoryPanel items={items} profileLabels={profileLabels} />;
}
