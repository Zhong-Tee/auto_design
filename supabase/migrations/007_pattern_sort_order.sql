-- Pattern display order (scoped per product)
ALTER TABLE patterns ADD COLUMN sort_order INT NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY product_id ORDER BY created_at) AS rn
  FROM patterns
)
UPDATE patterns p
SET sort_order = ranked.rn
FROM ranked
WHERE p.id = ranked.id;

CREATE INDEX idx_patterns_product_sort ON patterns(product_id, sort_order);
