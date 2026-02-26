-- Phase 5: Stripe Billing & Usage Tracking
-- Adds Stripe integration columns to subscriptions and creates usage_tracking table.

-- ── Extend subscriptions table with Stripe fields ──
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_price_id text;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval text DEFAULT 'monthly';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_started_at timestamptz;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS plan_id text DEFAULT 'free';

-- ── Usage tracking table ──
CREATE TABLE IF NOT EXISTS usage_tracking (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL,
    business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
    feature text NOT NULL,
    used_at timestamptz DEFAULT now(),
    month_year text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_feature
    ON usage_tracking(user_id, feature, month_year);

ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON usage_tracking
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can insert usage" ON usage_tracking
    FOR INSERT WITH CHECK (true);
