-- =====================================================
-- Migration to add must_change_password column to users table
-- =====================================================

-- Add must_change_password column to users table
ALTER TABLE users 
ADD COLUMN must_change_password BOOLEAN DEFAULT FALSE;

-- Set must_change_password to TRUE for existing student users to enforce password change on first login
UPDATE users 
SET must_change_password = TRUE 
WHERE role = 'student';

-- Add index for better query performance
CREATE INDEX idx_users_must_change_password ON users(must_change_password);