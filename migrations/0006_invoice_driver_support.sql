-- Add driver_id support to invoices table
-- This allows invoices to be issued to drivers independently of trips
-- Driver invoices can optionally be linked to a trip

-- Make trip_id nullable
ALTER TABLE invoices ALTER COLUMN trip_id DROP NOT NULL;

-- Add driver_id column (TEXT to match app_users.user_id type)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS driver_id TEXT REFERENCES app_users(user_id) ON UPDATE CASCADE ON DELETE SET NULL;

-- Add reason column for driver invoices
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reason TEXT;

-- Add constraint to ensure at least one of trip_id or driver_id is set
-- Allow both to be set for driver invoices linked to trips
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_invoice_entity'
        AND conrelid = 'invoices'::regclass
    ) THEN
        ALTER TABLE invoices ADD CONSTRAINT chk_invoice_entity CHECK (trip_id IS NOT NULL OR driver_id IS NOT NULL);
    END IF;
END $$;

-- Add index for driver_id
CREATE INDEX IF NOT EXISTS idx_invoices_driver_id ON invoices (driver_id);
