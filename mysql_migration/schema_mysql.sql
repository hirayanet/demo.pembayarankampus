-- =====================================================
-- MySQL Schema untuk Migrasi dari Supabase PostgreSQL
-- Database: pembayaran_kampus_local
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_uuid ON users(uuid);
CREATE INDEX idx_users_role ON users(role);

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
    type ENUM('fixed', 'installment') NOT NULL,
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
CREATE INDEX idx_bills_type ON bills(type);

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

-- Sample admin user
INSERT INTO users (uuid, email, password_hash, full_name, role, email_verified) VALUES 
(UUID(), 'admin@kampus.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Admin Kampus', 'admin', TRUE);

-- Sample staff user
INSERT INTO users (uuid, email, password_hash, full_name, role, email_verified) VALUES 
(UUID(), 'staff@kampus.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Staff Kampus', 'staff', TRUE);

-- Sample programs
INSERT INTO programs (uuid, code, name, faculty, level) VALUES 
(UUID(), 'IF', 'Teknik Informatika', 'Fakultas Teknik', 'S1'),
(UUID(), 'SI', 'Sistem Informasi', 'Fakultas Teknik', 'S1'),
(UUID(), 'TI', 'Teknologi Informasi', 'Fakultas Teknik', 'D3');

-- Sample bill categories
INSERT INTO bill_categories (uuid, name, default_amount, default_due_days, default_type) VALUES 
(UUID(), 'SPP', 2500000, 30, 'fixed'),
(UUID(), 'Praktikum', 500000, 14, 'fixed'),
(UUID(), 'Wisuda', 1000000, 60, 'installment');

-- Sample student
INSERT INTO users (uuid, email, password_hash, full_name, role, email_verified) VALUES 
(UUID(), 'student@kampus.edu', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Mahasiswa Test', 'student', TRUE);

SET @student_user_id = LAST_INSERT_ID();
SET @program_id = (SELECT id FROM programs WHERE code = 'IF' LIMIT 1);

INSERT INTO students (uuid, user_id, nim_kashif, name, email, prodi, angkatan, program_id) VALUES 
(UUID(), @student_user_id, '2024001', 'Mahasiswa Test', 'student@kampus.edu', 'Teknik Informatika', '2024', @program_id);

-- Sample bill
SET @student_id = (SELECT id FROM students WHERE nim_kashif = '2024001' LIMIT 1);
SET @category_id = (SELECT id FROM bill_categories WHERE name = 'SPP' LIMIT 1);

INSERT INTO bills (uuid, student_id, type, description, amount, due_date, category_id) VALUES 
(UUID(), @student_id, 'fixed', 'SPP Semester 1 - 2024', 2500000, DATE_ADD(CURDATE(), INTERVAL 30 DAY), @category_id);