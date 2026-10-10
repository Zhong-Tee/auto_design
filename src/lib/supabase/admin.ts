import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function createAdminClient(signal?: AbortSignal): SupabaseClient {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  if (!adminClient || signal) {
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        global: {
          fetch: (input, init) => fetch(input, {
            ...init,
            signal: AbortSignal.any([
              ...(init?.signal ? [init.signal] : []),
              ...(signal ? [signal] : []),
              AbortSignal.timeout(30_000),
            ]),
          }),
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
    if (signal) return client;
    adminClient = client;
  }

  return adminClient;
}
