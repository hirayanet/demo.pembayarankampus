-- Migration: Update bills.category_id FK to ON DELETE SET NULL
-- Purpose: Allow deleting a bill category without breaking existing bills.
-- Bills that reference the deleted category will have category_id set to NULL.

-- 1) Drop existing FK constraint (name may vary across environments, so drop by name if known)
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_category_id_fkey;

-- 2) Recreate FK with ON DELETE SET NULL
ALTER TABLE bills
  ADD CONSTRAINT bills_category_id_fkey
  FOREIGN KEY (category_id)
  REFERENCES bill_categories(id)
  ON DELETE SET NULL;

-- 3) Optional: comment
COMMENT ON CONSTRAINT bills_category_id_fkey ON bills IS 'FK to bill_categories; ON DELETE SET NULL to preserve bill history when a category is removed.';
