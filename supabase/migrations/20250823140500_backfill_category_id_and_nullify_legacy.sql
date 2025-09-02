-- Migration: Ensure legacy text category is fully deprecated
-- Step 1: Backfill bills.category_id from existing bill_categories by name match (case-insensitive)
UPDATE bills b
SET category_id = c.id
FROM bill_categories c
WHERE b.category_id IS NULL
  AND c.name = TRIM(LOWER(b.category));

-- Step 2: Nullify legacy text column for ALL rows to avoid future accidental backfill re-creation
UPDATE bills
SET category = NULL
WHERE category IS NOT NULL;

-- Step 3: Optional documentation
COMMENT ON COLUMN bills.category IS 'Deprecated. All logic should use category_id. This column is kept NULL to avoid accidental use.';
