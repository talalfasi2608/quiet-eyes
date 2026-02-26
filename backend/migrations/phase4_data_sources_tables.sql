-- Phase 4: Expanded Data Sources — new tables
-- Run this migration against your Supabase project.

-- =============================================================================
-- 1. Traffic Data — Google Popular Times & competitor comparison
-- =============================================================================
CREATE TABLE IF NOT EXISTS traffic_data (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    place_id text,
    busy_hours jsonb DEFAULT '{}',
    competitor_comparison jsonb DEFAULT '{}',
    scanned_at timestamptz DEFAULT now()
);

ALTER TABLE traffic_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own traffic data"
    ON traffic_data FOR SELECT
    USING (business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
    ));

-- =============================================================================
-- 2. Price Intelligence — competitor pricing data
-- =============================================================================
CREATE TABLE IF NOT EXISTS price_intelligence (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    competitor_name text,
    price_level integer,
    price_mentions jsonb DEFAULT '[]',
    ai_insight text DEFAULT '',
    scanned_at timestamptz DEFAULT now()
);

ALTER TABLE price_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own price intelligence"
    ON price_intelligence FOR SELECT
    USING (business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
    ));

-- =============================================================================
-- 3. Weather Forecasts — 7-day forecasts with business impact
-- =============================================================================
CREATE TABLE IF NOT EXISTS weather_forecasts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    forecast_date date NOT NULL,
    rain_mm float DEFAULT 0,
    temperature float DEFAULT 0,
    business_impact text DEFAULT 'neutral',
    created_at timestamptz DEFAULT now()
);

ALTER TABLE weather_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weather forecasts"
    ON weather_forecasts FOR SELECT
    USING (business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
    ));

-- =============================================================================
-- 4. Reputation Scores — multi-platform reputation tracking
-- =============================================================================
CREATE TABLE IF NOT EXISTS reputation_scores (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    platform text NOT NULL DEFAULT 'aggregate',
    score float,
    review_count integer,
    data jsonb DEFAULT '{}',
    scanned_at timestamptz DEFAULT now()
);

ALTER TABLE reputation_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own reputation scores"
    ON reputation_scores FOR SELECT
    USING (business_id IN (
        SELECT id FROM businesses WHERE user_id = auth.uid()
    ));

-- =============================================================================
-- Indexes for common query patterns
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_traffic_data_business
    ON traffic_data(business_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_intelligence_business
    ON price_intelligence(business_id, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_weather_forecasts_business_date
    ON weather_forecasts(business_id, forecast_date);

CREATE INDEX IF NOT EXISTS idx_reputation_scores_business
    ON reputation_scores(business_id, scanned_at DESC);

-- =============================================================================
-- Service-role INSERT policies (for backend automation)
-- =============================================================================
CREATE POLICY "Service role can insert traffic data"
    ON traffic_data FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can insert price intelligence"
    ON price_intelligence FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can insert weather forecasts"
    ON weather_forecasts FOR INSERT
    WITH CHECK (true);

CREATE POLICY "Service role can insert reputation scores"
    ON reputation_scores FOR INSERT
    WITH CHECK (true);
