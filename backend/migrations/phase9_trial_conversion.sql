-- Phase 9: Trial Conversion Flow
-- Add trial touchpoints tracking to subscriptions table

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS trial_touchpoints_sent TEXT DEFAULT '[]';

-- Index for efficient trial status queries
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial
ON subscriptions (user_id, trial_ends_at)
WHERE trial_ends_at IS NOT NULL;
