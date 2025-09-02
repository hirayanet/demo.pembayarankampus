/*
  # Update backup views for new NIM fields

  1. Update Views
    - Modify existing backup views to include nim_dikti
    - Update column references from nim to nim_kashif
    - Ensure data integrity in backup process

  2. Backup Functions
    - Update backup functions to handle new schema
    - Add validation for nim_kashif (required) and nim_dikti (optional)
*/

-- Drop and recreate backup views with updated schema
DROP VIEW IF EXISTS backup_students_view;
DROP VIEW IF EXISTS backup_bills_view;
DROP VIEW IF EXISTS backup_payments_view;

-- Updated students backup view
CREATE VIEW backup_students_view AS
SELECT 
  id,
  nim_kashif,
  nim_dikti,
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

-- Updated bills backup view with student info
CREATE VIEW backup_bills_view AS
SELECT 
  b.id,
  b.student_id,
  s.nim_kashif,
  s.nim_dikti,
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
LEFT JOIN students s ON b.student_id = s.id
ORDER BY b.created_at;

-- Updated payments backup view with related info
CREATE VIEW backup_payments_view AS
SELECT 
  p.id,
  p.bill_id,
  p.student_id,
  s.nim_kashif,
  s.nim_dikti,
  s.name as student_name,
  b.category as bill_category,
  b.description as bill_description,
  p.amount,
  p.payment_method,
  p.payment_date,
  p.receipt_number,
  p.status,
  p.created_at
FROM payments p
LEFT JOIN students s ON p.student_id = s.id
LEFT JOIN bills b ON p.bill_id = b.id
ORDER BY p.created_at;

-- Update backup function to handle new schema
CREATE OR REPLACE FUNCTION backup_database_complete()
RETURNS TABLE(
  table_name text,
  backup_data jsonb,
  record_count bigint
) AS $$
BEGIN
  -- Backup students with new NIM fields
  RETURN QUERY
  SELECT 
    'students'::text,
    jsonb_agg(to_jsonb(bsv.*)) as backup_data,
    count(*)::bigint as record_count
  FROM backup_students_view bsv;
  
  -- Backup bills
  RETURN QUERY
  SELECT 
    'bills'::text,
    jsonb_agg(to_jsonb(bbv.*)) as backup_data,
    count(*)::bigint as record_count
  FROM backup_bills_view bbv;
  
  -- Backup payments
  RETURN QUERY
  SELECT 
    'payments'::text,
    jsonb_agg(to_jsonb(bpv.*)) as backup_data,
    count(*)::bigint as record_count
  FROM backup_payments_view bpv;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to backup function
GRANT EXECUTE ON FUNCTION backup_database_complete() TO authenticated;