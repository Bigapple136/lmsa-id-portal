-- =============================================================================
-- LMSA ID Portal — Add side column to templates (009)
-- Run this to add dual-template support (front/back)
-- =============================================================================

-- Add side column to templates table
ALTER TABLE templates
ADD COLUMN IF NOT EXISTS side TEXT NOT NULL DEFAULT 'front'
CHECK (side IN ('front', 'back'));

-- Update index for active templates per side
DROP INDEX IF EXISTS idx_templates_is_active;
CREATE INDEX IF NOT EXISTS idx_templates_is_active_side ON templates(is_active, side) WHERE is_active = true;

-- Migrate existing active template to 'front' side
UPDATE templates SET side = 'front' WHERE is_active = true AND side IS NULL;

-- Ensure only one active per side (cleanup if needed)
-- This is handled by application logic on upload/activate