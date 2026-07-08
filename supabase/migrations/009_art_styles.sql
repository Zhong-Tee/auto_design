-- Art Styles (สำหรับเมนูหน้าเด็ก)

CREATE TABLE art_styles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt_template TEXT NOT NULL DEFAULT '',
  thumbnail_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_art_styles_sort ON art_styles(sort_order);

ALTER TABLE generations
  ADD COLUMN art_style_id UUID REFERENCES art_styles(id) ON DELETE SET NULL;

ALTER TABLE art_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "art_styles_select_active_or_admin"
  ON art_styles FOR SELECT
  TO authenticated
  USING (is_active = true OR is_admin());

CREATE POLICY "art_styles_insert_admin"
  ON art_styles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "art_styles_update_admin"
  ON art_styles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "art_styles_delete_admin"
  ON art_styles FOR DELETE
  TO authenticated
  USING (is_admin());

-- โมเดล OpenAI สำหรับสร้างรูป (เปลี่ยนได้จากหน้าตั้งค่า)
INSERT INTO app_settings (key, value)
VALUES ('openai_image_model', '"gpt-image-2"')
ON CONFLICT (key) DO NOTHING;
