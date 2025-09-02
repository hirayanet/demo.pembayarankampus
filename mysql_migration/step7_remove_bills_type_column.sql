-- =============================================================================
-- Step 7: Remove Bills Type Column Migration (MySQL)
-- Description: Remove the 'type' column from bills table as part of the 
--              bill type removal initiative
-- Date: 2025-08-31
-- =============================================================================

-- Before running this migration, ensure that:
-- 1. All frontend components have been updated to not use bill types
-- 2. All API endpoints have been updated to not require type parameter
-- 3. This migration should be run AFTER frontend changes are deployed

USE pembayaran_kampus_local;

-- Step 1: Check current bills table structure
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'pembayaran_kampus_local' 
  AND TABLE_NAME = 'bills' 
  AND COLUMN_NAME = 'type';

-- Step 2: Remove the type index first (if it exists)
-- MySQL doesn't support IF EXISTS for DROP INDEX, so we use a workaround
SET @index_exists = (SELECT COUNT(*) FROM information_schema.statistics 
                     WHERE table_schema = DATABASE() 
                     AND table_name = 'bills' 
                     AND index_name = 'idx_bills_type');

SET @sql = IF(@index_exists > 0, 
              'DROP INDEX idx_bills_type ON bills', 
              'SELECT "Index does not exist" as message');

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Step 3: Drop the type column from bills table
ALTER TABLE bills DROP COLUMN type;

-- Step 4: Verify the column has been removed
SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT 
FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_SCHEMA = 'pembayaran_kampus_local' 
  AND TABLE_NAME = 'bills' 
  AND COLUMN_NAME = 'type';

-- Step 5: Update bill_categories to remove default_type references (optional cleanup)
-- Note: We keep default_type in bill_categories as it can still be useful 
-- for providing default installment suggestions without enforcing bill types

-- Step 6: Show final bills table structure
DESCRIBE bills;

-- Migration completed successfully!
-- Bills table no longer has a 'type' column, making all bills flexible
-- Installment options are now controlled by the 'allowInstallment' boolean
-- and installment_count/installment_amount fields on a per-bill basis.