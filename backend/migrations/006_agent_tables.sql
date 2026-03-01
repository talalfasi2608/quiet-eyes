-- ═══════════════════════════════════════════════════════════
-- Phase 3: The 6 Agents — New Tables
-- ═══════════════════════════════════════════════════════════

-- Agent run history
CREATE TABLE IF NOT EXISTS agent_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    user_id UUID,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed')),
    items_found INTEGER DEFAULT 0,
    tokens_used INTEGER DEFAULT 0,
    error_message TEXT
);
CREATE INDEX IF NOT EXISTS idx_agent_runs_agent ON agent_runs(agent_name, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user ON agent_runs(user_id, started_at DESC);

-- Agent heartbeats (one row per agent)
CREATE TABLE IF NOT EXISTS agent_heartbeats (
    agent_name TEXT PRIMARY KEY,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'idle'
);

-- Agent findings (leads, insights, opportunities found by agents)
CREATE TABLE IF NOT EXISTS agent_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_name TEXT NOT NULL,
    user_id UUID,
    finding_type TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    score INTEGER DEFAULT 0,
    acted_upon BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_findings_user ON agent_findings(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_findings_agent ON agent_findings(agent_name, created_at DESC);

-- User feedback on findings (for learning system)
CREATE TABLE IF NOT EXISTS agent_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    finding_id UUID REFERENCES agent_findings(id) ON DELETE SET NULL,
    was_relevant BOOLEAN NOT NULL,
    led_to_customer BOOLEAN DEFAULT FALSE,
    feedback_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_user ON agent_feedback(user_id, feedback_at DESC);

-- Per-user agent learning profiles
CREATE TABLE IF NOT EXISTS user_agent_profiles (
    user_id UUID PRIMARY KEY,
    lead_scoring_context TEXT,
    optimal_score_threshold INTEGER DEFAULT 70,
    keywords_that_convert TEXT[],
    total_feedbacks INTEGER DEFAULT 0,
    last_learning_update TIMESTAMPTZ
);

-- AI token usage tracking
CREATE TABLE IF NOT EXISTS ai_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    agent_name TEXT NOT NULL,
    tokens INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_agent ON ai_usage(agent_name, created_at DESC);

-- Marketing content plans (hakol agent)
CREATE TABLE IF NOT EXISTS marketing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    week_start DATE NOT NULL,
    week_theme TEXT,
    posts JSONB DEFAULT '[]',
    weekly_tip TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_marketing_plans_business ON marketing_plans(business_id, week_start DESC);

-- Revenue trend snapshots (hakis agent)
CREATE TABLE IF NOT EXISTS revenue_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    trend TEXT DEFAULT 'stable' CHECK (trend IN ('up', 'down', 'stable')),
    risk_level TEXT DEFAULT 'low' CHECK (risk_level IN ('high', 'medium', 'low')),
    prediction TEXT,
    recommendation TEXT,
    data JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_revenue_trends_business ON revenue_trends(business_id, created_at DESC);

-- Review analysis results (haozen agent)
CREATE TABLE IF NOT EXISTS review_analyses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    my_strengths JSONB DEFAULT '[]',
    my_weaknesses JSONB DEFAULT '[]',
    competitor_weaknesses JSONB DEFAULT '[]',
    hidden_opportunity TEXT,
    recommended_action TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_review_analyses_business ON review_analyses(business_id, created_at DESC);

-- Market trend detections (hatavach agent)
CREATE TABLE IF NOT EXISTS market_trends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    trends JSONB DEFAULT '[]',
    upcoming_events JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_market_trends_business ON market_trends(business_id, created_at DESC);
