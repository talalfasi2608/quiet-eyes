-- Phase 8: Priorities & custom business type fields
-- Adds columns for onboarding wizard priorities and custom type.
-- Also widens activity_radius_km from INTEGER to NUMERIC for sub-km values.

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_type_custom TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS priorities TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;
ALTER TABLE businesses ALTER COLUMN activity_radius_km TYPE NUMERIC USING activity_radius_km::NUMERIC;

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS instagram_page TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS ideal_customer TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS search_keywords TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS exclude_keywords TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS manual_competitors TEXT;
