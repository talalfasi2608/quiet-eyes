"""
Run Phase 3 migration: Create missing automation tables.

Usage:
  python run_migration.py --db-url "postgresql://postgres.mvywtnjptbpxvmoldrxe:YOUR_PASSWORD@aws-0-REGION.pooler.supabase.com:6543/postgres"

  OR set DATABASE_URL environment variable:
  DATABASE_URL="..." python run_migration.py

Find your database URL in Supabase Dashboard → Settings → Database → Connection string (URI)
"""
import argparse
import os
import sys

MIGRATION_SQL = """
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
"""


def run_migration(db_url: str):
    try:
        import psycopg2
    except ImportError:
        print("ERROR: psycopg2 not installed. Run: pip install psycopg2-binary")
        sys.exit(1)

    print("Connecting to database...")
    try:
        conn = psycopg2.connect(db_url, connect_timeout=10)
        conn.autocommit = True
    except Exception as e:
        print(f"ERROR: Could not connect: {e}")
        sys.exit(1)

    print("Running Phase 3 migration...")
    cur = conn.cursor()
    try:
        cur.execute(MIGRATION_SQL)
        print("Migration completed successfully!")

        # Verify tables
        cur.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_name IN ('automation_settings', 'automation_log', 'campaigns', 'whatsapp_contexts')
            ORDER BY table_name;
        """)
        tables = [row[0] for row in cur.fetchall()]
        print(f"Verified tables: {', '.join(tables)}")
    except Exception as e:
        print(f"ERROR: Migration failed: {e}")
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run Phase 3 automation tables migration")
    parser.add_argument("--db-url", help="PostgreSQL connection URL")
    args = parser.parse_args()

    db_url = args.db_url or os.environ.get("DATABASE_URL")
    if not db_url:
        print("ERROR: Provide --db-url or set DATABASE_URL environment variable")
        print("Find it at: Supabase Dashboard → Settings → Database → Connection string (URI)")
        sys.exit(1)

    run_migration(db_url)
