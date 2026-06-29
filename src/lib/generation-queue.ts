import { createAdminClient } from "@/lib/supabase/admin";
import { processGenerationJob } from "@/lib/process-generation";

export const MAX_CONCURRENT_GENERATIONS = 2;
const STALE_PROCESSING_MS = 12 * 60 * 1000;

export async function kickGenerationQueue(): Promise<void> {
  const supabase = createAdminClient();

  const staleBefore = new Date(Date.now() - STALE_PROCESSING_MS).toISOString();
  await supabase
    .from("generations")
    .update({
      status: "pending",
      processing_started_at: null,
      error_message: null,
    })
    .eq("status", "processing")
    .lt("processing_started_at", staleBefore);

  const { count } = await supabase
    .from("generations")
    .select("*", { count: "exact", head: true })
    .eq("status", "processing");

  const running = count ?? 0;
  const slots = MAX_CONCURRENT_GENERATIONS - running;
  if (slots <= 0) return;

  const { data: pendingJobs } = await supabase
    .from("generations")
    .select("id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(slots);

  for (const job of pendingJobs ?? []) {
    void processGenerationJob(job.id);
  }
}
