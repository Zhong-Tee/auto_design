-- Allow users to delete their own generations; admins can delete any
CREATE POLICY "generations_delete_own_or_admin"
  ON generations FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() OR is_admin());
