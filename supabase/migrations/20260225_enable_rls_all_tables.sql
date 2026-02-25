-- ═══════════════════════════════════════════════════════════════════════════════
-- Quieteyes — Enable RLS + Add Policies for ALL Public Tables
-- Migration: 2026-02-25
--
-- IMPORTANT: Run this in the Supabase SQL Editor (Dashboard > SQL Editor).
-- Service-role key ALWAYS bypasses RLS, so the backend is unaffected.
-- These policies protect against direct anon-key access from the frontend.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1: Enable RLS on ALL tables
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS public.businesses             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.profiles               ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspaces             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.workspace_members      ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.competitors            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.leads_discovered       ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.intelligence_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.knowledge_base         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.chat_messages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.scheduled_jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.weekly_reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.audit_logs             ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_logs            ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.crm_integrations       ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2: Drop any existing policies (idempotent re-runs)
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 1: businesses
-- Ownership: user_id = auth.uid()
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "businesses_select_own" ON public.businesses
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "businesses_insert_own" ON public.businesses
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "businesses_update_own" ON public.businesses
    FOR UPDATE USING (user_id = auth.uid());

-- No DELETE policy — prevent accidental business deletion via frontend


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 2: profiles
-- Ownership: id = auth.uid() (profile row IS the user)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE USING (id = auth.uid());


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 3: workspaces
-- Ownership: user can see workspaces they belong to
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "workspaces_select_member" ON public.workspaces
    FOR SELECT USING (
        id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "workspaces_insert_own" ON public.workspaces
    FOR INSERT WITH CHECK (owner_id = auth.uid());

CREATE POLICY "workspaces_update_owner" ON public.workspaces
    FOR UPDATE USING (owner_id = auth.uid());


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLE 4: workspace_members
-- Ownership: see own membership + all members of workspaces you belong to
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "workspace_members_select" ON public.workspace_members
    FOR SELECT USING (
        user_id = auth.uid()
        OR workspace_id IN (
            SELECT workspace_id FROM public.workspace_members
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "workspace_members_insert" ON public.workspace_members
    FOR INSERT WITH CHECK (
        workspace_id IN (
            SELECT id FROM public.workspaces
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "workspace_members_update" ON public.workspace_members
    FOR UPDATE USING (
        workspace_id IN (
            SELECT id FROM public.workspaces
            WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "workspace_members_delete" ON public.workspace_members
    FOR DELETE USING (
        workspace_id IN (
            SELECT id FROM public.workspaces
            WHERE owner_id = auth.uid()
        )
    );


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLES 5-8: Business-owned tables (via business_id → businesses.user_id)
-- Pattern: competitors, leads_discovered, intelligence_events, crm_integrations
-- ═══════════════════════════════════════════════════════════════════════════════

-- Helper: reusable subquery
-- business_id IN (SELECT id FROM businesses WHERE user_id = auth.uid())

-- ── competitors ──────────────────────────────────────────────────────────────

CREATE POLICY "competitors_select_own" ON public.competitors
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "competitors_insert_own" ON public.competitors
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "competitors_update_own" ON public.competitors
    FOR UPDATE USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "competitors_delete_own" ON public.competitors
    FOR DELETE USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

-- ── leads_discovered ─────────────────────────────────────────────────────────

CREATE POLICY "leads_discovered_select_own" ON public.leads_discovered
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "leads_discovered_insert_own" ON public.leads_discovered
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "leads_discovered_update_own" ON public.leads_discovered
    FOR UPDATE USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "leads_discovered_delete_own" ON public.leads_discovered
    FOR DELETE USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

-- ── intelligence_events ──────────────────────────────────────────────────────

CREATE POLICY "intelligence_events_select_own" ON public.intelligence_events
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "intelligence_events_insert_own" ON public.intelligence_events
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "intelligence_events_update_own" ON public.intelligence_events
    FOR UPDATE USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "intelligence_events_delete_own" ON public.intelligence_events
    FOR DELETE USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

-- ── crm_integrations ─────────────────────────────────────────────────────────

CREATE POLICY "crm_integrations_select_own" ON public.crm_integrations
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "crm_integrations_insert_own" ON public.crm_integrations
    FOR INSERT WITH CHECK (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "crm_integrations_update_own" ON public.crm_integrations
    FOR UPDATE USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

CREATE POLICY "crm_integrations_delete_own" ON public.crm_integrations
    FOR DELETE USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLES 9-12: User-owned tables (user_id = auth.uid() directly)
-- Pattern: knowledge_base, chat_messages, notification_preferences, subscriptions
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── knowledge_base ───────────────────────────────────────────────────────────

CREATE POLICY "knowledge_base_select_own" ON public.knowledge_base
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "knowledge_base_insert_own" ON public.knowledge_base
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "knowledge_base_update_own" ON public.knowledge_base
    FOR UPDATE USING (user_id = auth.uid());

-- ── chat_messages ────────────────────────────────────────────────────────────

CREATE POLICY "chat_messages_select_own" ON public.chat_messages
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "chat_messages_insert_own" ON public.chat_messages
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- No UPDATE/DELETE — chat history is immutable

-- ── notification_preferences ─────────────────────────────────────────────────

CREATE POLICY "notification_preferences_select_own" ON public.notification_preferences
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notification_preferences_insert_own" ON public.notification_preferences
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "notification_preferences_update_own" ON public.notification_preferences
    FOR UPDATE USING (user_id = auth.uid());

-- ── subscriptions ────────────────────────────────────────────────────────────

CREATE POLICY "subscriptions_select_own" ON public.subscriptions
    FOR SELECT USING (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE via frontend — managed by backend/billing only


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLES 13-14: Business-owned system tables
-- scheduled_jobs, weekly_reports
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── scheduled_jobs ───────────────────────────────────────────────────────────

CREATE POLICY "scheduled_jobs_select_own" ON public.scheduled_jobs
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

-- No INSERT/UPDATE/DELETE via frontend — managed by backend scheduler only

-- ── weekly_reports ───────────────────────────────────────────────────────────

CREATE POLICY "weekly_reports_select_own" ON public.weekly_reports
    FOR SELECT USING (
        business_id IN (SELECT id FROM public.businesses WHERE user_id = auth.uid())
    );

-- No INSERT/UPDATE/DELETE via frontend — generated by backend only


-- ═══════════════════════════════════════════════════════════════════════════════
-- TABLES 15-16: System/Admin-only tables
-- audit_logs, system_logs — NO user-facing policies (service-role only)
-- ═══════════════════════════════════════════════════════════════════════════════

-- audit_logs: RLS enabled but NO policies = only service-role can access
-- system_logs: RLS enabled but NO policies = only service-role can access
-- This is intentional — these tables should never be readable from the frontend.


-- ═══════════════════════════════════════════════════════════════════════════════
-- STEP 3: Verification queries
-- Run these after the migration to confirm everything is correct.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Check 1: All tables should have RLS enabled (expect 0 rows)
-- SELECT tablename, rowsecurity
-- FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = false;

-- Check 2: Policy count per table (every table except audit_logs/system_logs should have >= 1)
-- SELECT tablename, count(*) as policy_count
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- GROUP BY tablename
-- ORDER BY tablename;

-- Check 3: Full policy listing
-- SELECT tablename, policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
-- ORDER BY tablename, policyname;
