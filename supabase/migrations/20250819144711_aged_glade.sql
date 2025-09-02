/*
  # Sample Data for Campus Payment System

  1. Sample Students
    - Insert demo students with various programs and years
  
  2. Sample Bills
    - Create bills for different categories and types
  
  3. Sample Payments
    - Add payment history for demonstration
*/

-- Insert sample students
INSERT INTO students (nim, name, email, phone, prodi, angkatan, address, status) VALUES
('2021001001', 'Ahmad Ridwan Pratama', 'ahmad.ridwan@student.campus.ac.id', '081234567890', 'Teknik Informatika', '2021', 'Jl. Merdeka No. 123, Jakarta', 'active'),
('2021001002', 'Siti Nurhaliza', 'siti.nurhaliza@student.campus.ac.id', '081234567891', 'Sistem Informasi', '2021', 'Jl. Sudirman No. 456, Jakarta', 'active'),
('2021001003', 'Budi Santoso', 'budi.santoso@student.campus.ac.id', '081234567892', 'Teknik Komputer', '2021', 'Jl. Thamrin No. 789, Jakarta', 'active'),
('2022001001', 'Dewi Sartika', 'dewi.sartika@student.campus.ac.id', '081234567893', 'Manajemen Informatika', '2022', 'Jl. Gatot Subroto No. 321, Jakarta', 'active'),
('2022001002', 'Eko Prasetyo', 'eko.prasetyo@student.campus.ac.id', '081234567894', 'Teknik Informatika', '2022', 'Jl. Kuningan No. 654, Jakarta', 'active'),
('2020001001', 'Rina Maharani', 'rina.maharani@student.campus.ac.id', '081234567895', 'Sistem Informasi', '2020', 'Jl. Senayan No. 987, Jakarta', 'graduated'),
('2023001001', 'Fajar Nugroho', 'fajar.nugroho@student.campus.ac.id', '081234567896', 'Teknik Komputer', '2023', 'Jl. Kemang No. 147, Jakarta', 'active'),
('2023001002', 'Maya Sari', 'maya.sari@student.campus.ac.id', '081234567897', 'Manajemen Informatika', '2023', 'Jl. Blok M No. 258, Jakarta', 'active');

-- Insert sample bills
INSERT INTO bills (student_id, type, category, description, amount, due_date, status, paid_amount, installment_count, installment_amount) VALUES
-- Ahmad Ridwan's bills
((SELECT id FROM students WHERE nim = '2021001001'), 'installment', 'bpp_gasal', 'BPP Semester Gasal 2024/2025', 2220000, '2024-02-28', 'partial', 1110000, 6, 370000),
((SELECT id FROM students WHERE nim = '2021001001'), 'fixed', 'ujian_gasal', 'Ujian Semester Gasal 2024/2025', 500000, '2024-01-30', 'unpaid', 0, NULL, NULL),
((SELECT id FROM students WHERE nim = '2021001001'), 'installment', 'rpl', 'Rekognisi Pembelajaran Lampau', 7500000, '2024-03-31', 'partial', 3750000, 4, 1875000),
((SELECT id FROM students WHERE nim = '2021001001'), 'fixed', 'pendaftaran', 'Biaya Pendaftaran Mahasiswa', 1000000, '2021-08-15', 'paid', 1000000, NULL, NULL),

-- Siti Nurhaliza's bills
((SELECT id FROM students WHERE nim = '2021001002'), 'installment', 'bpp_gasal', 'BPP Semester Gasal 2024/2025', 2220000, '2024-02-28', 'paid', 2220000, 6, 370000),
((SELECT id FROM students WHERE nim = '2021001002'), 'fixed', 'ujian_gasal', 'Ujian Semester Gasal 2024/2025', 500000, '2024-01-30', 'paid', 500000, NULL, NULL),
((SELECT id FROM students WHERE nim = '2021001002'), 'installment', 'bimbingan', 'Bimbingan & Yudisium', 2250000, '2024-06-30', 'unpaid', 0, 3, 750000),

-- Budi Santoso's bills
((SELECT id FROM students WHERE nim = '2021001003'), 'installment', 'bpp_genap', 'BPP Semester Genap 2023/2024', 2220000, '2024-07-31', 'partial', 740000, 6, 370000),
((SELECT id FROM students WHERE nim = '2021001003'), 'fixed', 'ujian_genap', 'Ujian Semester Genap 2023/2024', 500000, '2024-06-30', 'unpaid', 0, NULL, NULL),

-- Dewi Sartika's bills
((SELECT id FROM students WHERE nim = '2022001001'), 'installment', 'bpp_gasal', 'BPP Semester Gasal 2024/2025', 2220000, '2024-02-28', 'unpaid', 0, 6, 370000),
((SELECT id FROM students WHERE nim = '2022001001'), 'fixed', 'pendaftaran', 'Biaya Pendaftaran Mahasiswa', 1000000, '2022-08-15', 'paid', 1000000, NULL, NULL),

-- Eko Prasetyo's bills
((SELECT id FROM students WHERE nim = '2022001002'), 'installment', 'bpp_gasal', 'BPP Semester Gasal 2024/2025', 2220000, '2024-02-28', 'partial', 1110000, 6, 370000),
((SELECT id FROM students WHERE nim = '2022001002'), 'fixed', 'ujian_gasal', 'Ujian Semester Gasal 2024/2025', 500000, '2024-01-30', 'paid', 500000, NULL, NULL);

-- Insert sample payments
INSERT INTO payments (bill_id, student_id, amount, payment_method, payment_date, receipt_number, status) VALUES
-- Ahmad Ridwan's payments
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2021001001') AND category = 'bpp_gasal'), 
 (SELECT id FROM students WHERE nim = '2021001001'), 370000, 'Transfer Bank', '2024-01-15 10:30:00', 'RCP-2024-001', 'completed'),
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2021001001') AND category = 'bpp_gasal'), 
 (SELECT id FROM students WHERE nim = '2021001001'), 370000, 'Virtual Account', '2024-02-15 14:20:00', 'RCP-2024-002', 'completed'),
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2021001001') AND category = 'bpp_gasal'), 
 (SELECT id FROM students WHERE nim = '2021001001'), 370000, 'Transfer Bank', '2024-03-15 09:45:00', 'RCP-2024-003', 'completed'),
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2021001001') AND category = 'rpl'), 
 (SELECT id FROM students WHERE nim = '2021001001'), 1875000, 'Transfer Bank', '2024-01-10 16:00:00', 'RCP-2024-004', 'completed'),
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2021001001') AND category = 'rpl'), 
 (SELECT id FROM students WHERE nim = '2021001001'), 1875000, 'Virtual Account', '2024-02-10 11:30:00', 'RCP-2024-005', 'completed'),
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2021001001') AND category = 'pendaftaran'), 
 (SELECT id FROM students WHERE nim = '2021001001'), 1000000, 'Transfer Bank', '2021-08-15 08:00:00', 'RCP-2021-100', 'completed'),

-- Siti Nurhaliza's payments
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2021001002') AND category = 'bpp_gasal'), 
 (SELECT id FROM students WHERE nim = '2021001002'), 2220000, 'Virtual Account', '2024-01-20 13:15:00', 'RCP-2024-006', 'completed'),
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2021001002') AND category = 'ujian_gasal'), 
 (SELECT id FROM students WHERE nim = '2021001002'), 500000, 'Transfer Bank', '2024-01-25 15:45:00', 'RCP-2024-007', 'completed'),

-- Budi Santoso's payments
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2021001003') AND category = 'bpp_genap'), 
 (SELECT id FROM students WHERE nim = '2021001003'), 370000, 'Virtual Account', '2024-01-05 12:20:00', 'RCP-2024-008', 'completed'),
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2021001003') AND category = 'bpp_genap'), 
 (SELECT id FROM students WHERE nim = '2021001003'), 370000, 'Transfer Bank', '2024-02-05 10:10:00', 'RCP-2024-009', 'completed'),

-- Dewi Sartika's payments
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2022001001') AND category = 'pendaftaran'), 
 (SELECT id FROM students WHERE nim = '2022001001'), 1000000, 'Transfer Bank', '2022-08-15 09:30:00', 'RCP-2022-200', 'completed'),

-- Eko Prasetyo's payments
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2022001002') AND category = 'bpp_gasal'), 
 (SELECT id FROM students WHERE nim = '2022001002'), 370000, 'Virtual Account', '2024-01-12 14:00:00', 'RCP-2024-010', 'completed'),
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2022001002') AND category = 'bpp_gasal'), 
 (SELECT id FROM students WHERE nim = '2022001002'), 370000, 'Transfer Bank', '2024-02-12 16:30:00', 'RCP-2024-011', 'completed'),
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2022001002') AND category = 'bpp_gasal'), 
 (SELECT id FROM students WHERE nim = '2022001002'), 370000, 'Virtual Account', '2024-03-12 11:45:00', 'RCP-2024-012', 'completed'),
((SELECT id FROM bills WHERE student_id = (SELECT id FROM students WHERE nim = '2022001002') AND category = 'ujian_gasal'), 
 (SELECT id FROM students WHERE nim = '2022001002'), 500000, 'Transfer Bank', '2024-01-28 13:20:00', 'RCP-2024-013', 'completed');