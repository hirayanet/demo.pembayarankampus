-- Migration: Make legacy bills.category column nullable to avoid NOT NULL violation
-- Context: We now rely on bills.category_id and a trigger nullifies the legacy text column.
-- The trigger (trg_bills_nullify_legacy_category) sets NEW.category := NULL on insert/update.
-- Therefore, the legacy column must allow NULLs.

ALTER TABLE bills
  ALTER COLUMN category DROP NOT NULL;

-- Optional: ensure default is NULL for clarity
ALTER TABLE bills
  ALTER COLUMN category SET DEFAULT NULL;
