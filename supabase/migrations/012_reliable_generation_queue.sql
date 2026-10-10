BEGIN;

ALTER TABLE public.generations
  ADD COLUMN IF NOT EXISTS request_id UUID,
  ADD COLUMN IF NOT EXISTS worker_token UUID,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS processing_step TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE public.generations DROP CONSTRAINT IF EXISTS generations_status_check;
ALTER TABLE public.generations ADD CONSTRAINT generations_status_check
  CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled'));

-- Only server-side worker/cancellation code may mutate execution ownership.
DROP POLICY IF EXISTS generations_update_own_or_admin ON public.generations;
DROP POLICY IF EXISTS generations_insert_own ON public.generations;
CREATE POLICY generations_insert_own ON public.generations FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_active_user() AND status = 'pending'
    AND worker_token IS NULL AND heartbeat_at IS NULL AND processing_started_at IS NULL
    AND processing_step IS NULL AND completed_at IS NULL AND output_image_url IS NULL
    AND attempt_count = 0);

CREATE UNIQUE INDEX IF NOT EXISTS generations_request_id_unique
  ON public.generations(user_id, request_id) WHERE request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS generations_active_order_unique
  ON public.generations(user_id, order_number)
  WHERE status IN ('pending', 'processing') AND order_number IS NOT NULL;

-- Slot counting and claims are serialized across all workers.
CREATE OR REPLACE FUNCTION public.claim_generation_jobs()
RETURNS SETOF public.generations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE available_slots INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(734810026);
  -- Unknown API outcomes must not be replayed automatically.
  UPDATE public.generations
  SET status = 'failed', processing_step = 'interrupted', worker_token = NULL,
      completed_at = now(),
      error_message = 'ขาดการติดต่อกับตัวประมวลผล งานอาจส่งถึง AI แล้ว กรุณาตรวจสอบก่อนสร้างใหม่'
  WHERE status = 'processing'
    AND COALESCE(heartbeat_at, processing_started_at, created_at) < now() - interval '3 minutes';
  SELECT GREATEST(0, 2 - COUNT(*)::INTEGER) INTO available_slots
    FROM public.generations WHERE status = 'processing';
  RETURN QUERY
  WITH candidates AS (
    SELECT id FROM public.generations WHERE status = 'pending'
    ORDER BY created_at, id LIMIT available_slots FOR UPDATE SKIP LOCKED
  )
  UPDATE public.generations g
    SET status = 'processing', worker_token = gen_random_uuid(),
        processing_started_at = now(), heartbeat_at = now(),
        processing_step = 'loading', error_message = NULL, attempt_count = 0
    FROM candidates c WHERE g.id = c.id AND g.status = 'pending'
    RETURNING g.*;
END;
$$;
REVOKE ALL ON FUNCTION public.claim_generation_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_generation_jobs() TO service_role;

COMMIT;
