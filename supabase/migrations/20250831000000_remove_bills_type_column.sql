-- =============================================================================
-- Step 7: Remove Bills Type Column Migration (Supabase PostgreSQL)
-- Description: Remove the 'type' column and bill_type enum from bills table 
--              as part of the bill type removal initiative
-- Date: 2025-08-31
-- =============================================================================

-- Before running this migration, ensure that:
-- 1. All frontend components have been updated to not use bill types
-- 2. All API endpoints have been updated to not require type parameter
-- 3. This migration should be run AFTER frontend changes are deployed

BEGIN;

-- Step 1: Remove the type column from bills table
-- This will automatically drop the constraint referencing the bill_type enum
ALTER TABLE public.bills DROP COLUMN IF EXISTS type;

-- Step 2: Remove any existing indexes on the type column (if they exist)
-- PostgreSQL will automatically drop indexes when the column is dropped
DROP INDEX IF EXISTS idx_bills_type;

-- Step 3: Optionally drop the bill_type enum if no other tables use it
-- Check if any other tables reference this enum first
DO $$
DECLARE
    enum_usage_count INTEGER;
BEGIN
    -- Check if bill_type enum is still used anywhere else
    SELECT COUNT(*) INTO enum_usage_count
    FROM information_schema.columns 
    WHERE udt_name = 'bill_type' 
      AND table_schema = 'public';
    
    IF enum_usage_count = 0 THEN
        -- Safe to drop the enum as it's no longer used
        DROP TYPE IF EXISTS public.bill_type;
        RAISE NOTICE 'bill_type enum has been dropped as it is no longer used';
    ELSE
        RAISE NOTICE 'bill_type enum is still in use by % columns, not dropping', enum_usage_count;
    END IF;
END $$;

-- Step 4: Update any existing triggers or functions that might reference the type column
-- The legacy category nullifier trigger should continue to work fine

-- Step 5: Verify the column has been removed
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'bills' 
          AND column_name = 'type'
    ) THEN
        RAISE EXCEPTION 'ERROR: type column still exists in bills table';
    ELSE
        RAISE NOTICE 'SUCCESS: type column has been successfully removed from bills table';
    END IF;
END $$;

-- Step 6: Show final bills table structure
-- \d public.bills; -- Commented out as this is psql-specific command

COMMIT;

-- Migration completed successfully!
-- Bills table no longer has a 'type' column, making all bills flexible
-- The bill_type enum has been removed if no other tables were using it
-- Installment options are now controlled by the allowInstallment boolean
-- and installment_count/installment_amount fields on a per-bill basis