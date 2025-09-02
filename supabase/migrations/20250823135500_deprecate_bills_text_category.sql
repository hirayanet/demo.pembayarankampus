-- Migration: Deprecate legacy bills.category text column to prevent accidental re-creation of categories
-- Goal: Ensure deleted categories do not reappear via old backfill scripts that read bills.category.

-- 1) Cleanup existing data: nullify legacy text category when FK is present
UPDATE bills
SET category = NULL
WHERE category_id IS NOT NULL AND category IS NOT NULL;

-- 2) Create a trigger to always nullify legacy text category on insert/update
CREATE OR REPLACE FUNCTION bills_nullify_legacy_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Force legacy text column to NULL so future scripts can't rely on it
  NEW.category := NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bills_nullify_legacy_category ON bills;
CREATE TRIGGER trg_bills_nullify_legacy_category
  BEFORE INSERT OR UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION bills_nullify_legacy_category();

-- 3) Optional: comment to document deprecation
COMMENT ON COLUMN bills.category IS 'Deprecated legacy free-text category. Use category_id referencing bill_categories. Maintained as NULL via trigger.';
