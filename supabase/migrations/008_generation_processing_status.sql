ALTER TABLE generations DROP CONSTRAINT IF EXISTS generations_status_check;

ALTER TABLE generations
  ADD CONSTRAINT generations_status_check
  CHECK (status IN ('pending', 'processing', 'success', 'failed'));

ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
