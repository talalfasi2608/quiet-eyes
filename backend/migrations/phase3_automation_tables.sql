-- Phase 3: Automation Engine — 4 new tables
-- Run via Supabase SQL Editor

-- automation_settings: per-business toggles
CREATE TABLE IF NOT EXISTS public.automation_settings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL UNIQUE REFERENCES public.businesses(id) ON DELETE CASCADE,
    review_responder boolean NOT NULL DEFAULT true,
    lead_alerts boolean NOT NULL DEFAULT true,
    competitor_alerts boolean NOT NULL DEFAULT true,
    morning_briefing boolean NOT NULL DEFAULT true,
    campaign_generator boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- automation_log: audit trail
CREATE TABLE IF NOT EXISTS public.automation_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    automation_type text NOT NULL,
    trigger_event text NOT NULL DEFAULT '',
    action_taken text NOT NULL DEFAULT '',
    result text NOT NULL DEFAULT '',
    details jsonb DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_automation_log_biz ON automation_log(business_id, created_at DESC);

-- campaigns: generated marketing campaigns
CREATE TABLE IF NOT EXISTS public.campaigns (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    campaign_name text NOT NULL DEFAULT '',
    trigger text NOT NULL DEFAULT '',
    facebook_post text NOT NULL DEFAULT '',
    instagram_caption text NOT NULL DEFAULT '',
    whatsapp_message text NOT NULL DEFAULT '',
    offer text NOT NULL DEFAULT '',
    status text NOT NULL DEFAULT 'draft',
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_campaigns_biz ON campaigns(business_id, created_at DESC);

-- whatsapp_contexts: pending approval workflows
CREATE TABLE IF NOT EXISTS public.whatsapp_contexts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number text NOT NULL,
    context_type text NOT NULL,
    context_data jsonb NOT NULL DEFAULT '{}',
    business_id uuid REFERENCES public.businesses(id) ON DELETE CASCADE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_ctx_phone ON whatsapp_contexts(phone_number, expires_at DESC);

-- RLS
ALTER TABLE automation_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_contexts ENABLE ROW LEVEL SECURITY;
