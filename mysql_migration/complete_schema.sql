-- =====================================================
-- Complete MySQL Schema for Campus Payment System
-- Database: pembayaran_kampus
-- Version: 1.0
-- =====================================================

-- Drop existing tables if any (for clean migration)
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS bills;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS programs;
DROP TABLE IF EXISTS bill_categories;
DROP TABLE IF EXISTS user_roles;
DROP TABLE IF EXISTS settings;
DROP TABLE IF EXISTS users;
SET FOREIGN_KEY_CHECKS = 1;

-- =====================
-- Users table (replacement for Supabase Auth)
-- =====================
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role ENUM('admin', 'staff', 'student') NOT NULL DEFAULT 'student',
    email_verified BOOLEAN DEFAULT FALSE,
    must_change_password BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_uuid ON users(uuid);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_must_change_password ON users(must_change_password);

-- =====================
-- Programs table
-- =====================
CREATE TABLE programs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    faculty VARCHAR(255),
    level VARCHAR(100),
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_programs_code ON programs(code);
CREATE INDEX idx_programs_name ON programs(name);

-- =====================
-- Bill Categories table
-- =====================
CREATE TABLE bill_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    name VARCHAR(255) UNIQUE NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    default_amount DECIMAL(15,2) CHECK (default_amount > 0),
    default_due_days INT CHECK (default_due_days > 0),
    default_type ENUM('fixed', 'installment'),
    default_installment_count INT CHECK (default_installment_count > 0),
    default_installment_amount DECIMAL(15,2) CHECK (default_installment_amount > 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_bill_categories_name ON bill_categories(name);
CREATE INDEX idx_bill_categories_active ON bill_categories(active);

-- =====================
-- Students table
-- =====================
CREATE TABLE students (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    user_id INT,
    nim_kashif VARCHAR(50) UNIQUE NOT NULL,
    nim_dikti VARCHAR(50),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(20),
    prodi VARCHAR(255) NOT NULL,
    angkatan VARCHAR(10) NOT NULL,
    address TEXT,
    status ENUM('active', 'inactive', 'graduated') DEFAULT 'active',
    program_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE SET NULL
);

CREATE INDEX idx_students_nim_kashif ON students(nim_kashif);
CREATE INDEX idx_students_nim_dikti ON students(nim_dikti);
CREATE INDEX idx_students_email ON students(email);
CREATE INDEX idx_students_status ON students(status);
CREATE INDEX idx_students_program_id ON students(program_id);
CREATE INDEX idx_students_user_id ON students(user_id);

-- =====================
-- Bills table
-- =====================
CREATE TABLE bills (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    student_id INT NOT NULL,
    category VARCHAR(255), -- legacy field (will be deprecated)
    description TEXT NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    due_date DATE NOT NULL,
    status ENUM('paid', 'unpaid', 'partial') DEFAULT 'unpaid',
    paid_amount DECIMAL(15,2) DEFAULT 0 CHECK (paid_amount >= 0),
    installment_count INT CHECK (installment_count > 0),
    installment_amount DECIMAL(15,2) CHECK (installment_amount > 0),
    category_id INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES bill_categories(id) ON DELETE SET NULL
);

CREATE INDEX idx_bills_student_id ON bills(student_id);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_due_date ON bills(due_date);
CREATE INDEX idx_bills_category_id ON bills(category_id);

-- =====================
-- Payments table
-- =====================
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uuid CHAR(36) UNIQUE NOT NULL DEFAULT (UUID()),
    bill_id INT,
    student_id INT NOT NULL,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    payment_method VARCHAR(100) NOT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    receipt_number VARCHAR(255) UNIQUE NOT NULL,
    notes TEXT,
    status ENUM('completed', 'pending', 'failed') DEFAULT 'completed',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (bill_id) REFERENCES bills(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE INDEX idx_payments_bill_id ON payments(bill_id);
CREATE INDEX idx_payments_student_id ON payments(student_id);
CREATE INDEX idx_payments_date ON payments(payment_date);
CREATE INDEX idx_payments_receipt ON payments(receipt_number);
CREATE INDEX idx_payments_status ON payments(status);

-- =====================
-- User Roles table (for admin/staff management)
-- =====================
CREATE TABLE user_roles (
    user_id INT PRIMARY KEY,
    role ENUM('admin', 'staff') NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_user_roles_role ON user_roles(role);
CREATE INDEX idx_user_roles_active ON user_roles(active);

-- =====================
-- Settings table
-- =====================
CREATE TABLE settings (
    id VARCHAR(50) PRIMARY KEY,
    security JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default settings
INSERT INTO settings (id, security) VALUES ('system', '{}');

-- =====================
-- Insert Sample Data for Testing
-- =====================

-- Sample admin user with default password 'password'
INSERT INTO users (uuid, email, password_hash, full_name, role, email_verified) VALUES 
(UUID(), 'admin@kampus.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin Kampus', 'admin', TRUE);

-- Sample staff user with default password 'password'
INSERT INTO users (uuid, email, password_hash, full_name, role, email_verified) VALUES 
(UUID(), 'staff@kampus.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Staff Kampus', 'staff', TRUE);

-- Sample programs
INSERT INTO programs (uuid, code, name, faculty, level) VALUES 
(UUID(), 'TI', 'Teknik Informatika', 'Fakultas Teknik', 'S1'),
(UUID(), 'SI', 'Sistem Informasi', 'Fakultas Teknik', 'S1'),
(UUID(), 'TK', 'Teknik Komputer', 'Fakultas Teknik', 'D3');

-- Sample students (with default password 'kamal123')
INSERT INTO users (uuid, email, password_hash, full_name, role, email_verified, must_change_password) VALUES 
(UUID(), 'ahmad.ridwan@student.campus.ac.id', '$2b$10$lD2BUn8c6E4v.TuO38XpQOaK3Gzg0h1uY6lF/XKdOz/3p.6QzqW7e', 'Ahmad Ridwan Pratama', 'student', TRUE, TRUE),
(UUID(), 'siti.nurhaliza@student.campus.ac.id', '$2b$10$lD2BUn8c6E4v.TuO38XpQOaK3Gzg0h1uY6lF/XKdOz/3p.6QzqW7e', 'Siti Nurhaliza', 'student', TRUE, TRUE);

INSERT INTO students (uuid, user_id, nim_kashif, name, email, phone, prodi, angkatan, address) VALUES 
(UUID(), (SELECT id FROM users WHERE email = 'ahmad.ridwan@student.campus.ac.id'), '2021001001', 'Ahmad Ridwan Pratama', 'ahmad.ridwan@student.campus.ac.id', '081234567890', 'Teknik Informatika', '2021', 'Jl. Merdeka No. 123, Jakarta'),
(UUID(), (SELECT id FROM users WHERE email = 'siti.nurhaliza@student.campus.ac.id'), '2021001002', 'Siti Nurhaliza', 'siti.nurhaliza@student.campus.ac.id', '081234567891', 'Sistem Informasi', '2021', 'Jl. Sudirman No. 456, Jakarta');

-- Sample bill categories
INSERT INTO bill_categories (uuid, name, active, default_amount, default_due_days, default_type, default_installment_count, default_installment_amount) VALUES 
(UUID(), 'BPP Gasal', TRUE, 2220000.00, 30, 'installment', 6, 370000.00),
(UUID(), 'BPP Genap', TRUE, 2220000.00, 30, 'installment', 6, 370000.00),
(UUID(), 'Ujian Gasal', TRUE, 500000.00, 15, 'fixed', NULL, NULL),
(UUID(), 'Ujian Genap', TRUE, 500000.00, 15, 'fixed', NULL, NULL),
(UUID(), 'Pendaftaran', TRUE, 1000000.00, 7, 'fixed', NULL, NULL);

-- Sample bills
INSERT INTO bills (uuid, student_id, category, description, amount, due_date, status, paid_amount, installment_count, installment_amount, category_id) VALUES
-- Ahmad Ridwan's bills
((SELECT id FROM students WHERE nim_kashif = '2021001001'), 'installment', 'bpp_gasal', 'BPP Semester Gasal 2024/2025', 2220000, '2024-02-28', 'partial', 1110000, 6, 370000, (SELECT id FROM bill_categories WHERE name = 'BPP Gasal')),
((SELECT id FROM students WHERE nim_kashif = '2021001001'), 'fixed', 'ujian_gasal', 'Ujian Semester Gasal 2024/2025', 500000, '2024-01-30', 'unpaid', 0, NULL, NULL, (SELECT id FROM bill_categories WHERE name = 'Ujian Gasal')),
((SELECT id FROM students WHERE nim_kashif = '2021001001'), 'installment', 'rpl', 'Rekognisi Pembelajaran Lampau', 7500000, '2024-03-31', 'partial', 3750000, 4, 1875000, NULL),
((SELECT id FROM students WHERE nim_kashif = '2021001001'), 'fixed', 'pendaftaran', 'Biaya Pendaftaran Mahasiswa', 1000000, '2021-08-15', 'paid', 1000000, NULL, NULL, (SELECT id FROM bill_categories WHERE name = 'Pendaftaran')),

-- Siti Nurhaliza's bills
((SELECT id FROM students WHERE nim_kashif = '2021001002'), 'installment', 'bpp_gasal', 'BPP Semester Gasal 2024/2025', 2220000, '2024-02-28', 'paid', 2220000, 6, 370000, (SELECT id FROM bill_categories WHERE name = 'BPP Gasal')),
((SELECT id FROM students WHERE nim_kashif = '2021001002'), 'fixed', 'ujian_gasal', 'Ujian Semester Gasal 2024/2025', 500000, '2024-01-30', 'paid', 500000, NULL, NULL, (SELECT id FROM bill_categories WHERE name = 'Ujian Gasal')),
((SELECT id FROM students WHERE nim_kashif = '2021001002'), 'installment', 'bimbingan', 'Bimbingan & Yudisium', 2250000, '2024-06-30', 'unpaid', 0, 3, 750000, NULL);

-- Sample payments
INSERT INTO payments (uuid, bill_id, student_id, amount, payment_method, payment_date, receipt_number, status) VALUES
-- Ahmad Ridwan's payments
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2021001001') AND category = 'bpp_gasal' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2021001001'), 370000, 'Transfer Bank', '2024-01-15 10:30:00', 'RCP-2024-001', 'completed'),
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2021001001') AND category = 'bpp_gasal' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2021001001'), 370000, 'Virtual Account', '2024-02-15 14:20:00', 'RCP-2024-002', 'completed'),
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2021001001') AND category = 'bpp_gasal' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2021001001'), 370000, 'Transfer Bank', '2024-03-15 09:45:00', 'RCP-2024-003', 'completed'),
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2021001001') AND description = 'Rekognisi Pembelajaran Lampau' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2021001001'), 1875000, 'Transfer Bank', '2024-01-10 16:00:00', 'RCP-2024-004', 'completed'),
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2021001001') AND description = 'Rekognisi Pembelajaran Lampau' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2021001001'), 1875000, 'Virtual Account', '2024-02-10 11:30:00', 'RCP-2024-005', 'completed'),
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2021001001') AND category = 'pendaftaran' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2021001001'), 1000000, 'Transfer Bank', '2021-08-15 08:00:00', 'RCP-2021-100', 'completed'),

-- Siti Nurhaliza's payments
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2021001002') AND category = 'bpp_gasal' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2021001002'), 2220000, 'Virtual Account', '2024-01-20 13:15:00', 'RCP-2024-006', 'completed'),
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2021001002') AND category = 'ujian_gasal' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2021001002'), 500000, 'Transfer Bank', '2024-01-25 15:45:00', 'RCP-2024-007', 'completed'),

-- Budi Santoso's payments
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2021001003') AND category = 'bpp_genap' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2021001003'), 370000, 'Virtual Account', '2024-01-05 12:20:00', 'RCP-2024-008', 'completed'),
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2021001003') AND category = 'bpp_genap' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2021001003'), 370000, 'Transfer Bank', '2024-02-05 10:10:00', 'RCP-2024-009', 'completed'),

-- Dewi Sartika's payments
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2022001001') AND category = 'pendaftaran' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2022001001'), 1000000, 'Transfer Bank', '2022-08-15 09:30:00', 'RCP-2022-200', 'completed'),

-- Eko Prasetyo's payments
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2022001002') AND category = 'bpp_gasal' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2022001002'), 370000, 'Virtual Account', '2024-01-12 14:00:00', 'RCP-2024-010', 'completed'),
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2022001002') AND category = 'bpp_gasal' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2022001002'), 370000, 'Transfer Bank', '2024-02-12 16:30:00', 'RCP-2024-011', 'completed'),
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2022001002') AND category = 'bpp_gasal' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2022001002'), 370000, 'Virtual Account', '2024-03-12 11:45:00', 'RCP-2024-012', 'completed'),
((SELECT uuid FROM bills WHERE student_id = (SELECT id FROM students WHERE nim_kashif = '2022001002') AND category = 'ujian_gasal' LIMIT 1), 
 (SELECT id FROM students WHERE nim_kashif = '2022001002'), 500000, 'Transfer Bank', '2024-01-28 13:20:00', 'RCP-2024-013', 'completed');