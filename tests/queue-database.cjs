/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("@electric-sql/pglite");

async function main() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-4000-8000-000000000001'::uuid $$;
      CREATE FUNCTION public.is_active_user() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
      CREATE TABLE public.generations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
        order_number text, status text NOT NULL DEFAULT 'pending',
        created_at timestamptz NOT NULL DEFAULT now(), processing_started_at timestamptz,
        error_message text, output_image_url text
      );
      ALTER TABLE public.generations ENABLE ROW LEVEL SECURITY;
      GRANT USAGE ON SCHEMA public, auth TO authenticated, service_role;
      GRANT SELECT, INSERT, UPDATE ON public.generations TO authenticated;
      CREATE POLICY generations_select_own ON public.generations FOR SELECT TO authenticated USING (user_id = auth.uid());
      CREATE POLICY generations_update_own_or_admin ON public.generations FOR UPDATE TO authenticated USING (true);
      CREATE POLICY generations_insert_own ON public.generations FOR INSERT TO authenticated WITH CHECK (true);
    `);
    await db.exec(fs.readFileSync("supabase/migrations/012_reliable_generation_queue.sql", "utf8"));
    // Idempotent migration reruns must also be valid.
    await db.exec(fs.readFileSync("supabase/migrations/012_reliable_generation_queue.sql", "utf8"));
    const owner = "00000000-0000-4000-8000-000000000001";
    for (let i = 1; i <= 4; i++) {
      await db.query("INSERT INTO generations (user_id, order_number, created_at) VALUES ($1, $2, now() + ($3 || ' seconds')::interval)", [owner, `ORD-${i}`, i]);
    }
    const [first, second] = await Promise.all([
      db.query("SELECT * FROM claim_generation_jobs()"), db.query("SELECT * FROM claim_generation_jobs()"),
    ]);
    const claimed = [...first.rows, ...second.rows];
    assert.equal(claimed.length, 2, "Concurrent dispatches must share two global slots");
    assert.deepEqual(claimed.map((job) => job.order_number).sort(), ["ORD-1", "ORD-2"]);
    assert.equal(new Set(claimed.map((job) => job.worker_token)).size, 2);
    await assert.rejects(() => db.query("INSERT INTO generations (user_id, order_number) VALUES ($1, 'ORD-1')", [owner]), /duplicate key/);

    // A healthy but long-running job must not be replayed; a dead worker must fail, not requeue.
    await db.query("UPDATE generations SET processing_started_at = now() - interval '20 minutes', heartbeat_at = now() WHERE order_number = 'ORD-1'");
    await db.query("UPDATE generations SET heartbeat_at = now() - interval '4 minutes' WHERE order_number = 'ORD-2'");
    const refill = await db.query("SELECT * FROM claim_generation_jobs()");
    assert.equal(refill.rows.length, 1);
    assert.equal(refill.rows[0].order_number, "ORD-3");
    const stale = (await db.query("SELECT * FROM generations WHERE order_number = 'ORD-2'")).rows[0];
    assert.equal(stale.status, "failed");
    assert.equal(stale.worker_token, null);
    assert.ok(stale.completed_at);
    const late = await db.query("UPDATE generations SET status = 'success' WHERE id = $1 AND worker_token = $2 AND status = 'processing' RETURNING id", [stale.id, claimed.find((job) => job.id === stale.id).worker_token]);
    assert.equal(late.rows.length, 0, "Dead worker results must be fenced out");

    await db.query("UPDATE generations SET status = 'cancelled', worker_token = NULL, completed_at = now() WHERE order_number = 'ORD-3'");
    const next = await db.query("SELECT * FROM claim_generation_jobs()");
    assert.equal(next.rows.length, 1);
    assert.equal(next.rows[0].order_number, "ORD-4");

    await db.exec("SET ROLE authenticated");
    await assert.rejects(() => db.query("SELECT * FROM claim_generation_jobs()"), /permission denied/);
    const userUpdate = await db.query("UPDATE generations SET worker_token = gen_random_uuid() WHERE order_number = 'ORD-1' RETURNING id");
    assert.equal(userUpdate.rows.length, 0, "Browser clients cannot change worker ownership");
    await assert.rejects(() => db.query("INSERT INTO generations (user_id, order_number, status) VALUES ($1, 'fake-worker', 'processing')", [owner]), /row-level security/);
    await db.query("INSERT INTO generations (user_id, order_number, request_id) VALUES ($1, 'ORD-5', '00000000-0000-4000-8000-000000000099')", [owner]);
    await assert.rejects(() => db.query("INSERT INTO generations (user_id, order_number, request_id) VALUES ($1, 'ORD-6', '00000000-0000-4000-8000-000000000099')", [owner]), /duplicate key/);
    console.log("PASS: real PostgreSQL migration, FIFO/global slots, unique active orders/request ids, healthy heartbeat, dead worker recovery without replay, lease fencing, cancellation, and RLS permissions");
  } finally { await db.close(); }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
