/*
  # Initial Schema for Campus Payment System

  1. New Tables
    - `students`
      - `id` (uuid, primary key)
      - `nim` (text, unique)
      - `name` (text)
      - `email` (text, unique)
      - `phone` (text, optional)
      - `prodi` (text)
      - `angkatan` (text)
      - `address` (text, optional)
      - `status` (enum: active, inactive, graduated)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `bills`
      - `id` (uuid, primary key)
      - `student_id` (uuid, foreign key)
      - `type` (enum: fixed, installment)
      - `category` (text)
      - `description` (text)
      - `amount` (numeric)
      - `due_date` (date)
      - `status` (enum: paid, unpaid, partial)
      - `paid_amount` (numeric, default 0)
      - `installment_count` (integer, optional)
      - `installment_amount` (numeric, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

    - `payments`
      - `id` (uuid, primary key)
      - `bill_id` (uuid, foreign key)
      - `student_id` (uuid, foreign key)
      - `amount` (numeric)
      - `payment_method` (text)
      - `payment_date` (timestamp)
      - `receipt_number` (text, unique)
      - `status` (enum: completed, pending, failed)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create enum types
CREATE TYPE student_status AS ENUM ('active', 'inactive', 'graduated');
CREATE TYPE bill_type AS ENUM ('fixed', 'installment');
CREATE TYPE bill_status AS ENUM ('paid', 'unpaid', 'partial');
CREATE TYPE payment_status AS ENUM ('completed', 'pending', 'failed');

-- Students table
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nim text UNIQUE NOT NULL,
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  phone text,
  prodi text NOT NULL,
  angkatan text NOT NULL,
  address text,
  status student_status DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Bills table
CREATE TABLE IF NOT EXISTS bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  type bill_type NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  due_date date NOT NULL,
  status bill_status DEFAULT 'unpaid',
  paid_amount numeric DEFAULT 0 CHECK (paid_amount >= 0),
  installment_count integer CHECK (installment_count > 0),
  installment_amount numeric CHECK (installment_amount > 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid REFERENCES bills(id) ON DELETE CASCADE,
  student_id uuid REFERENCES students(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_method text NOT NULL,
  payment_date timestamptz DEFAULT now(),
  receipt_number text UNIQUE NOT NULL,
  status payment_status DEFAULT 'completed',
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create policies for students table
CREATE POLICY "Students can read own data"
  ON students
  FOR SELECT
  TO authenticated
  USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage students"
  ON students
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Create policies for bills table
CREATE POLICY "Students can read own bills"
  ON bills
  FOR SELECT
  TO authenticated
  USING (student_id::text = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage bills"
  ON bills
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Create policies for payments table
CREATE POLICY "Students can read own payments"
  ON payments
  FOR SELECT
  TO authenticated
  USING (student_id::text = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Users can create payments"
  ON payments
  FOR INSERT
  TO authenticated
  WITH CHECK (student_id::text = auth.uid()::text OR auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Admins can manage payments"
  ON payments
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_students_nim ON students(nim);
CREATE INDEX IF NOT EXISTS idx_students_status ON students(status);
CREATE INDEX IF NOT EXISTS idx_bills_student_id ON bills(student_id);
CREATE INDEX IF NOT EXISTS idx_bills_status ON bills(status);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_bill_id ON payments(bill_id);
CREATE INDEX IF NOT EXISTS idx_payments_student_id ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON payments(payment_date);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();