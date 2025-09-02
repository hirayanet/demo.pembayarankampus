-- Migration: Extend bill_categories with default bill type and installment fields
-- 1) Add columns (nullable for backward compatibility)
ALTER TABLE bill_categories
  ADD COLUMN IF NOT EXISTS default_type text CHECK (default_type IN ('fixed','installment')),
  ADD COLUMN IF NOT EXISTS default_installment_count integer CHECK (default_installment_count > 0),
  ADD COLUMN IF NOT EXISTS default_installment_amount numeric CHECK (default_installment_amount > 0);

-- 2) No backfill necessary; admins can set defaults from Settings UI

-- 3) Comment for documentation
COMMENT ON COLUMN bill_categories.default_type IS 'Default bill type for this category: fixed or installment';
COMMENT ON COLUMN bill_categories.default_installment_count IS 'Default installment count when type is installment';
COMMENT ON COLUMN bill_categories.default_installment_amount IS 'Default installment amount when type is installment';
