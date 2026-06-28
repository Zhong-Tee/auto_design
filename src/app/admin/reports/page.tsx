import { createClient } from "@/lib/supabase/server";
import { ReportsPanel } from "./reports-panel";

export default async function AdminReportsPage() {
  const supabase = await createClient();

  const [{ data: generations }, { data: profiles }] = await Promise.all([
    supabase
      .from("generations")
      .select("*")
      .eq("status", "success")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, email, display_name").order("email"),
  ]);

  return (
    <ReportsPanel
      generations={generations ?? []}
      profiles={profiles ?? []}
    />
  );
}
