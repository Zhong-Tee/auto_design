-- Order number for output file naming

ALTER TABLE generations
  ADD COLUMN IF NOT EXISTS order_number TEXT;

CREATE INDEX IF NOT EXISTS idx_generations_order_number
  ON generations(order_number);
