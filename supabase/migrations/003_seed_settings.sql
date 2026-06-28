-- TR Kids AI Image Generator — Seed default settings

INSERT INTO app_settings (key, value) VALUES
  ('usd_to_thb', '35'),
  ('price_text_input_per_1m', '5'),
  ('price_image_input_per_1m', '10'),
  ('price_image_output_per_1m', '8')
ON CONFLICT (key) DO NOTHING;
