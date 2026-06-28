-- TR Kids AI Image Generator — RLS Policies

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE text_box_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE shapes ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

-- Helper: check if current user is active admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND is_active = true
  );
$$;

-- Helper: check if current user is active
CREATE OR REPLACE FUNCTION is_active_user()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND is_active = true
  );
$$;

-- profiles
CREATE POLICY "profiles_select_own_or_admin"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_update_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "profiles_insert_admin"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- products
CREATE POLICY "products_select_active_or_admin"
  ON products FOR SELECT
  TO authenticated
  USING (is_active = true OR is_admin());

CREATE POLICY "products_insert_admin"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "products_update_admin"
  ON products FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "products_delete_admin"
  ON products FOR DELETE
  TO authenticated
  USING (is_admin());

-- text_box_configs
CREATE POLICY "text_box_configs_select"
  ON text_box_configs FOR SELECT
  TO authenticated
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM products p
      WHERE p.id = text_box_configs.product_id AND p.is_active = true
    )
  );

CREATE POLICY "text_box_configs_insert_admin"
  ON text_box_configs FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "text_box_configs_update_admin"
  ON text_box_configs FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "text_box_configs_delete_admin"
  ON text_box_configs FOR DELETE
  TO authenticated
  USING (is_admin());

-- patterns
CREATE POLICY "patterns_select_active_or_admin"
  ON patterns FOR SELECT
  TO authenticated
  USING (is_active = true OR is_admin());

CREATE POLICY "patterns_insert_admin"
  ON patterns FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "patterns_update_admin"
  ON patterns FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "patterns_delete_admin"
  ON patterns FOR DELETE
  TO authenticated
  USING (is_admin());

-- shapes
CREATE POLICY "shapes_select_active_or_admin"
  ON shapes FOR SELECT
  TO authenticated
  USING (is_active = true OR is_admin());

CREATE POLICY "shapes_insert_admin"
  ON shapes FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "shapes_update_admin"
  ON shapes FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "shapes_delete_admin"
  ON shapes FOR DELETE
  TO authenticated
  USING (is_admin());

-- prompts
CREATE POLICY "prompts_select_authenticated"
  ON prompts FOR SELECT
  TO authenticated
  USING (is_active_user());

CREATE POLICY "prompts_insert_admin"
  ON prompts FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "prompts_update_admin"
  ON prompts FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "prompts_delete_admin"
  ON prompts FOR DELETE
  TO authenticated
  USING (is_admin());

-- app_settings
CREATE POLICY "app_settings_select_authenticated"
  ON app_settings FOR SELECT
  TO authenticated
  USING (is_active_user());

CREATE POLICY "app_settings_insert_admin"
  ON app_settings FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "app_settings_update_admin"
  ON app_settings FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "app_settings_delete_admin"
  ON app_settings FOR DELETE
  TO authenticated
  USING (is_admin());

-- generations
CREATE POLICY "generations_select_own_or_admin"
  ON generations FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "generations_insert_own"
  ON generations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_active_user());

CREATE POLICY "generations_update_own_or_admin"
  ON generations FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());
