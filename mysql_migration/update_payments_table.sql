-- Update payments table to add missing columns
-- Run this if the table already exists

ALTER TABLE payments 
ADD COLUMN notes TEXT AFTER receipt_number,
ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at;

-- Verify the table structure
DESCRIBE payments;