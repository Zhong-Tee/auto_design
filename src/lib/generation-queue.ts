import { createAdminClient } from "@/lib/supabase/admin";
import type { Generation } from "@/types/database";

export async function claimGenerationJobs(): Promise<Generation[]> {
  // Only the persistent worker calls this. The database owns the global slot lock.
  const { data, error } = await createAdminClient().rpc("claim_generation_jobs");
  if (error) throw new Error(`จองงานคิวไม่สำเร็จ: ${error.message}`);
  return (data as Generation[] | null) ?? [];
}
