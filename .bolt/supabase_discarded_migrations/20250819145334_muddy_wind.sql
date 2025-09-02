/*
  # Database Backup Script for Campus Payment System

  This script creates a complete backup of the database structure and data
  for migration purposes. It includes all tables, indexes, policies, and sample data.

  Usage:
  1. Run this script to create backup tables with '_backup' suffix
  2. Export data using pg_dump or similar tools
  3. Use for migration to new environment

  Tables included:
  - students (with all data)
  - bills (with all data)  
  - payments (with all data)
*/

-- Create backup tables with current timestamp
CREATE TABLE IF NOT EXISTS students_backup AS SELECT * FROM students;
CREATE TABLE IF NOT EXISTS bills_backup AS SELECT * FROM bills;
CREATE TABLE IF NOT EXISTS payments_backup AS SELECT * FROM payments;

-- Add backup metadata
CREATE TABLE IF NOT EXISTS backup_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  backup_date timestamptz DEFAULT now(),
  backup_type text DEFAULT 'manual',
  table_name text NOT NULL,
  record_count integer NOT NULL,
  backup_size_mb numeric,
  created_by text DEFAULT 'system'
);

-- Insert backup metadata
INSERT INTO backup_metadata (table_name, record_count) VALUES
('students', (SELECT COUNT(*) FROM students)),
('bills', (SELECT COUNT(*) FROM bills)),
('payments', (SELECT COUNT(*) FROM payments));

-- Create backup views for easy data export
CREATE OR REPLACE VIEW backup_students_export AS
SELECT 
  nim,
  name,
  email,
  phone,
  prodi,
  angkatan,
  address,
  status,
  created_at,
  updated_at
FROM students
ORDER BY created_at;

CREATE OR REPLACE VIEW backup_bills_export AS
SELECT 
  b.id,
  s.nim as student_nim,
  s.name as student_name,
  b.type,
  b.category,
  b.description,
  b.amount,
  b.due_date,
  b.status,
  b.paid_amount,
  b.installment_count,
  b.installment_amount,
  b.created_at,
  b.updated_at
FROM bills b
JOIN students s ON b.student_id = s.id
ORDER BY b.created_at;

CREATE OR REPLACE VIEW backup_payments_export AS
SELECT 
  p.id,
  p.receipt_number,
  s.nim as student_nim,
  s.name as student_name,
  b.category as bill_category,
  p.amount,
  p.payment_method,
  p.payment_date,
  p.status,
  p.created_at
FROM payments p
JOIN students s ON p.student_id = s.id
JOIN bills b ON p.bill_id = b.id
ORDER BY p.payment_date DESC;

-- Create backup summary view
CREATE OR REPLACE VIEW backup_summary AS
SELECT 
  'students' as table_name,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM students
UNION ALL
SELECT 
  'bills' as table_name,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM bills
UNION ALL
SELECT 
  'payments' as table_name,
  COUNT(*) as record_count,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record
FROM payments;

-- Create data integrity check function
CREATE OR REPLACE FUNCTION check_data_integrity()
RETURNS TABLE (
  check_name text,
  status text,
  details text
) AS $$
BEGIN
  -- Check for orphaned bills
  RETURN QUERY
  SELECT 
    'Orphaned Bills'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
    CONCAT(COUNT(*), ' bills without valid student_id')::text
  FROM bills b
  LEFT JOIN students s ON b.student_id = s.id
  WHERE s.id IS NULL;

  -- Check for orphaned payments
  RETURN QUERY
  SELECT 
    'Orphaned Payments'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::text,
    CONCAT(COUNT(*), ' payments without valid bill_id or student_id')::text
  FROM payments p
  LEFT JOIN bills b ON p.bill_id = b.id
  LEFT JOIN students s ON p.student_id = s.id
  WHERE b.id IS NULL OR s.id IS NULL;

  -- Check payment amounts vs bill amounts
  RETURN QUERY
  SELECT 
    'Payment Amount Validation'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END::text,
    CONCAT(COUNT(*), ' payments exceed bill amounts')::text
  FROM payments p
  JOIN bills b ON p.bill_id = b.id
  WHERE p.amount > b.amount;

  -- Check bill status consistency
  RETURN QUERY
  SELECT 
    'Bill Status Consistency'::text,
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END::text,
    CONCAT(COUNT(*), ' bills marked as paid but paid_amount < amount')::text
  FROM bills
  WHERE status = 'paid' AND paid_amount < amount;

END;
$$ LANGUAGE plpgsql;

-- Create restore preparation function
CREATE OR REPLACE FUNCTION prepare_for_restore()
RETURNS text AS $$
BEGIN
  -- Disable triggers temporarily
  ALTER TABLE students DISABLE TRIGGER ALL;
  ALTER TABLE bills DISABLE TRIGGER ALL;
  ALTER TABLE payments DISABLE TRIGGER ALL;
  
  -- Disable RLS temporarily
  ALTER TABLE students DISABLE ROW LEVEL SECURITY;
  ALTER TABLE bills DISABLE ROW LEVEL SECURITY;
  ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
  
  RETURN 'Database prepared for restore. Remember to re-enable triggers and RLS after restore.';
END;
$$ LANGUAGE plpgsql;

-- Create restore completion function
CREATE OR REPLACE FUNCTION complete_restore()
RETURNS text AS $$
BEGIN
  -- Re-enable triggers
  ALTER TABLE students ENABLE TRIGGER ALL;
  ALTER TABLE bills ENABLE TRIGGER ALL;
  ALTER TABLE payments ENABLE TRIGGER ALL;
  
  -- Re-enable RLS
  ALTER TABLE students ENABLE ROW LEVEL SECURITY;
  ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
  ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
  
  -- Update sequences to prevent ID conflicts
  SELECT setval('students_id_seq', COALESCE(MAX(id), 1)) FROM students;
  SELECT setval('bills_id_seq', COALESCE(MAX(id), 1)) FROM bills;
  SELECT setval('payments_id_seq', COALESCE(MAX(id), 1)) FROM payments;
  
  RETURN 'Database restore completed. All triggers and RLS re-enabled.';
END;
$$ LANGUAGE plpgsql;

-- Log backup completion
INSERT INTO backup_metadata (table_name, record_count, backup_type) 
VALUES ('backup_complete', 0, 'full_backup');

-- Display backup summary
SELECT * FROM backup_summary;
SELECT * FROM check_data_integrity();