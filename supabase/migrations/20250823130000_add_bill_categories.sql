-- Migration: Add bill_categories master table and integrate with bills
-- 1) Create table bill_categories
CREATE TABLE IF NOT EXISTS bill_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  active boolean NOT NULL DEFAULT true,
  default_amount numeric CHECK (default_amount > 0),
  default_due_days integer CHECK (default_due_days > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2) Add nullable FK on bills for backward compatibility
ALTER TABLE bills ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES bill_categories(id);

-- 3) Migrate distinct existing text categories into master table, then backfill bills.category_id
DO $$
DECLARE
  rec RECORD;
  cat_id uuid;
BEGIN
  -- Insert distinct categories from existing data
  FOR rec IN (
    SELECT DISTINCT TRIM(LOWER(category)) AS cat
    FROM bills
    WHERE category IS NOT NULL AND TRIM(category) <> ''
  ) LOOP
    -- Insert if not exists
    INSERT INTO bill_categories (name)
    SELECT rec.cat
    WHERE NOT EXISTS (SELECT 1 FROM bill_categories WHERE name = rec.cat);
  END LOOP;

  -- Update bills.category_id using name match (case-insensitive via lowered name)
  UPDATE bills b
  SET category_id = c.id
  FROM bill_categories c
  WHERE c.name = TRIM(LOWER(b.category))
    AND b.category_id IS NULL;
END $$ LANGUAGE plpgsql;

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_bill_categories_name ON bill_categories(name);
CREATE INDEX IF NOT EXISTS idx_bills_category_id ON bills(category_id);

-- 5) Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_bill_categories_updated_at ON bill_categories;
CREATE TRIGGER update_bill_categories_updated_at
  BEFORE UPDATE ON bill_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 6) RLS and policies
ALTER TABLE bill_categories ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read categories
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bill_categories' AND policyname = 'Categories read for all authenticated'
  ) THEN
    CREATE POLICY "Categories read for all authenticated"
      ON bill_categories
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$ LANGUAGE plpgsql;

-- Allow admins to manage categories (expects JWT claim role = 'admin')
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bill_categories' AND policyname = 'Admins manage categories'
  ) THEN
    CREATE POLICY "Admins manage categories"
      ON bill_categories
      FOR ALL
      TO authenticated
      USING ((auth.jwt() ->> 'role') = 'admin')
      WITH CHECK ((auth.jwt() ->> 'role') = 'admin');
  END IF;
END $$ LANGUAGE plpgsql;
