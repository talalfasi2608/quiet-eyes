-- ═══════════════════════════════════════════════════════════════════════════════
-- Quieteyes — RLS Verification Queries
-- Run these in Supabase SQL Editor to audit RLS status
-- ═══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 1: Which tables have RLS DISABLED? (should be EMPTY after fix)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 2: Tables with RLS disabled (should return 0 rows after fix)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false;


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 3: Policy count per table
-- Every table should have at least 1 policy (except audit_logs, system_logs
-- which have 0 policies intentionally — service-role only)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    t.tablename,
    COALESCE(p.policy_count, 0) AS policy_count,
    t.rowsecurity AS rls_enabled
FROM pg_tables t
LEFT JOIN (
    SELECT tablename, count(*) AS policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
    GROUP BY tablename
) p ON t.tablename = p.tablename
WHERE t.schemaname = 'public'
ORDER BY COALESCE(p.policy_count, 0) ASC, t.tablename;


-- ─────────────────────────────────────────────────────────────────────────────
-- CHECK 4: Full policy listing (detailed)
-- ─────────────────────────────────────────────────────────────────────────────
SELECT
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual AS using_expression,
    with_check AS with_check_expression
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
