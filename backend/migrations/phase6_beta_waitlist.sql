-- ═══════════════════════════════════════════════════════════════════════════════
-- Phase 6: Beta Waitlist, Referrals & Feedback
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. Beta Waitlist
CREATE TABLE IF NOT EXISTS beta_waitlist (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           TEXT NOT NULL UNIQUE,
    phone           TEXT,
    name            TEXT NOT NULL,
    business_type   TEXT,
    referral_code   TEXT NOT NULL UNIQUE,
    referred_by     UUID REFERENCES beta_waitlist(id),
    position        INTEGER NOT NULL,
    status          TEXT NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'invited', 'activated', 'churned')),
    source          TEXT DEFAULT 'organic'
                    CHECK (source IN ('facebook', 'whatsapp', 'linkedin', 'organic', 'referral')),
    invited_at      TIMESTAMPTZ,
    activated_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_beta_waitlist_status ON beta_waitlist(status);
CREATE INDEX IF NOT EXISTS idx_beta_waitlist_referral_code ON beta_waitlist(referral_code);
CREATE INDEX IF NOT EXISTS idx_beta_waitlist_referred_by ON beta_waitlist(referred_by);
CREATE INDEX IF NOT EXISTS idx_beta_waitlist_position ON beta_waitlist(position);
CREATE INDEX IF NOT EXISTS idx_beta_waitlist_email ON beta_waitlist(email);

-- 2. Beta Feedback
CREATE TABLE IF NOT EXISTS beta_feedback (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL,
    type            TEXT NOT NULL
                    CHECK (type IN ('nps', 'feature_request', 'bug', 'general')),
    score           INTEGER CHECK (score >= 0 AND score <= 10),
    message         TEXT,
    trigger         TEXT DEFAULT 'manual'
                    CHECK (trigger IN ('day_7', 'day_14', 'day_30', 'manual')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_beta_feedback_user_id ON beta_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_type ON beta_feedback(type);
CREATE INDEX IF NOT EXISTS idx_beta_feedback_trigger ON beta_feedback(trigger);

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE beta_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE beta_feedback ENABLE ROW LEVEL SECURITY;

-- Service-role has full access (bypasses RLS by default)
-- Users can read their own waitlist entry by email
CREATE POLICY beta_waitlist_select_own ON beta_waitlist
    FOR SELECT USING (
        email = current_setting('request.jwt.claims', true)::json->>'email'
    );

-- Users can read their own feedback
CREATE POLICY beta_feedback_select_own ON beta_feedback
    FOR SELECT USING (
        user_id::text = (current_setting('request.jwt.claims', true)::json->>'sub')
    );

-- Users can insert their own feedback
CREATE POLICY beta_feedback_insert_own ON beta_feedback
    FOR INSERT WITH CHECK (
        user_id::text = (current_setting('request.jwt.claims', true)::json->>'sub')
    );

-- Public insert for waitlist (no auth needed - handled at API level)
CREATE POLICY beta_waitlist_insert_public ON beta_waitlist
    FOR INSERT WITH CHECK (true);
