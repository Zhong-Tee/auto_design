-- Product thumbnail for selection UI

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS image_url TEXT;
