-- Phase 7: Registration & Onboarding fields
-- Adds new columns to businesses table for the redesigned registration flow.

ALTER TABLE businesses ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS activity_radius_km INTEGER DEFAULT 5;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notification_whatsapp BOOLEAN DEFAULT TRUE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notification_email BOOLEAN DEFAULT TRUE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS notification_weekly_report BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS morning_alert_time TEXT DEFAULT '09:00';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS onboarding_step INTEGER DEFAULT 0;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS business_description TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS facebook_page TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS target_audience_tags TEXT;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS alert_sensitivity TEXT DEFAULT 'medium';
