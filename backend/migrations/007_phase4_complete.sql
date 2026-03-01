-- ═══════════════════════════════════════════════════════════
-- Phase 4: Complete Schema — Missing tables + referrals + success stories
-- ═══════════════════════════════════════════════════════════

-- Referrals system
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id UUID NOT NULL,
    referred_email VARCHAR(255),
    referred_user_id UUID,
    referral_code VARCHAR(20),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'signed_up', 'converted', 'rewarded')),
    reward_given BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    converted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);

-- Success stories (lead → customer conversion tracking)
CREATE TABLE IF NOT EXISTS success_stories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    lead_id UUID,
    result VARCHAR(50),
    value_ils INTEGER,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_success_stories_user ON success_stories(user_id);

-- WhatsApp logs (if not already created)
CREATE TABLE IF NOT EXISTS whatsapp_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    phone VARCHAR(30),
    message_type VARCHAR(50),
    message_text TEXT,
    status VARCHAR(20) DEFAULT 'sent',
    provider VARCHAR(20) DEFAULT 'green_api',
    sent_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_user ON whatsapp_logs(user_id, sent_at DESC);

-- Weekly reports (ensure exists with correct schema)
CREATE TABLE IF NOT EXISTS weekly_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    business_id UUID,
    week_start DATE,
    pdf_url TEXT,
    data JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ,
    generated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_weekly_reports_user ON weekly_reports(user_id, week_start DESC);

-- Add event_type column to agent_runs if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'agent_runs' AND column_name = 'event_type'
    ) THEN
        ALTER TABLE agent_runs ADD COLUMN event_type VARCHAR(50);
    END IF;
END $$;

-- Add best_lead_sources to user_agent_profiles if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'user_agent_profiles' AND column_name = 'best_lead_sources'
    ) THEN
        ALTER TABLE user_agent_profiles ADD COLUMN best_lead_sources TEXT[];
    END IF;
END $$;

-- Add provider column to whatsapp_logs if missing
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'whatsapp_logs' AND column_name = 'provider'
    ) THEN
        ALTER TABLE whatsapp_logs ADD COLUMN provider VARCHAR(20) DEFAULT 'twilio';
    END IF;
END $$;

-- Ensure all core indexes exist (idempotent)
CREATE INDEX IF NOT EXISTS idx_leads_user_score ON leads(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_found_at ON leads(found_at DESC);
CREATE INDEX IF NOT EXISTS idx_competitors_user_threat ON competitors(user_id, threat_level);
CREATE INDEX IF NOT EXISTS idx_intel_user_urgency ON intel_items(user_id, urgency);
CREATE INDEX IF NOT EXISTS idx_daily_tasks_user_date ON daily_tasks(user_id, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_health_score_user_date ON health_score_history(user_id, calculated_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_date ON agent_runs(agent_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ai_usage(created_at DESC);
