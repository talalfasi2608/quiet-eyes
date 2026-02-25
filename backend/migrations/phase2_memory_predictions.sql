-- Phase 2: AI Memory Layer + Predictive Engine
-- Run via Supabase SQL editor

-- ═══════════════════════════════════════════════════════════════
-- Weekly business snapshots for AI memory
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.business_memory (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id           uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    week_start            date NOT NULL,

    -- Metrics snapshot
    leads_found           integer DEFAULT 0,
    leads_converted       integer DEFAULT 0,
    avg_rating            float,
    review_count          integer,
    competitor_count       integer,
    top_threat_competitor  text,

    -- Events that week
    key_events            jsonb DEFAULT '[]'::jsonb,
    -- [{"type": "competitor_promo", "name": "רם ספורט", "detail": "מבצע חורף -20%"}]

    -- AI analysis
    weekly_summary        text,
    main_opportunity      text,
    main_threat           text,

    -- Trends
    trend_direction       text,   -- improving / declining / stable
    trend_score           float,

    created_at            timestamptz DEFAULT now(),
    UNIQUE(business_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_memory_biz     ON business_memory(business_id);
CREATE INDEX IF NOT EXISTS idx_memory_created ON business_memory(created_at DESC);
ALTER TABLE public.business_memory ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════
-- AI-discovered business patterns
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.business_patterns (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    pattern_type      text,
    -- seasonal, weekly, competitor_behavior, lead_source
    pattern_data      jsonb,
    confidence        float,
    discovered_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_patterns_biz ON business_patterns(business_id);
ALTER TABLE public.business_patterns ENABLE ROW LEVEL SECURITY;


-- ═══════════════════════════════════════════════════════════════
-- AI-generated predictions
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.business_predictions (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id       uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    prediction_type   text NOT NULL DEFAULT 'weekly',
    prediction_data   jsonb NOT NULL DEFAULT '{}'::jsonb,
    confidence        float DEFAULT 0.5,
    valid_from        date NOT NULL,
    valid_until       date NOT NULL,
    created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pred_biz   ON business_predictions(business_id);
CREATE INDEX IF NOT EXISTS idx_pred_valid ON business_predictions(valid_from, valid_until);
ALTER TABLE public.business_predictions ENABLE ROW LEVEL SECURITY;
