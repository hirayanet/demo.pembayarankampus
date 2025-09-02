-- Migration: Update RLS policy on bill_categories to check admin role in app_metadata
-- Context: Move from root-level `role` claim to `app_metadata.role` in JWT.

-- 1) Drop existing admin manage policy if present
DROP POLICY IF EXISTS "Admins manage categories" ON bill_categories;

-- 2) Recreate admin manage policy using app_metadata.role
CREATE POLICY "Admins manage categories"
  ON bill_categories
  FOR ALL
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Note: Keep your read/select policy for authenticated users as-is.
-- If you don't have one yet, uncomment below:
-- CREATE POLICY "Authenticated can read categories"
--   ON bill_categories
--   FOR SELECT
--   TO authenticated
--   USING (true);
