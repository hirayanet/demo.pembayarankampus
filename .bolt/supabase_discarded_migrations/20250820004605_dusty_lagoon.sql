/*
  # Update NIM fields - Add NIM DIKTI and rename NIM to NIM KASHIF

  1. Schema Changes
    - Rename `nim` column to `nim_kashif` in students table
    - Add new `nim_dikti` column (nullable, will be populated later)
    - Update indexes to reflect new column names
    - Maintain data integrity during migration

  2. Data Migration
    - Preserve existing NIM data by moving to nim_kashif
    - Set nim_dikti as NULL initially (to be populated later)

  3. Security
    - Maintain existing RLS policies
    - Update policies to reference new column names
*/

-- Add new nim_dikti column first
ALTER TABLE students ADD COLUMN IF NOT EXISTS nim_dikti text;

-- Rename nim column to nim_kashif
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'students' AND column_name = 'nim'
  ) THEN
    ALTER TABLE students RENAME COLUMN nim TO nim_kashif;
  END IF;
END $$;

-- Drop old index and create new ones
DROP INDEX IF EXISTS idx_students_nim;
DROP INDEX IF EXISTS students_nim_key;

-- Create new indexes for nim_kashif
CREATE UNIQUE INDEX IF NOT EXISTS students_nim_kashif_key ON students USING btree (nim_kashif);
CREATE INDEX IF NOT EXISTS idx_students_nim_kashif ON students USING btree (nim_kashif);

-- Create index for nim_dikti (non-unique since it can be NULL)
CREATE INDEX IF NOT EXISTS idx_students_nim_dikti ON students USING btree (nim_dikti);

-- Update RLS policies to use new column name
DROP POLICY IF EXISTS "Students can read own data" ON students;
CREATE POLICY "Students can read own data"
  ON students
  FOR SELECT
  TO authenticated
  USING (((uid())::text = (id)::text) OR ((jwt() ->> 'role'::text) = 'admin'::text));

-- Add comment for documentation
COMMENT ON COLUMN students.nim_kashif IS 'NIM KASHIF - Internal campus student ID';
COMMENT ON COLUMN students.nim_dikti IS 'NIM DIKTI - National higher education student ID (to be populated later)';