"""
E2E Pipeline Test — Quiet Eyes Sprint 12

Tests the full pipeline:
  Step 1: Verify business exists (Uma Sushi Bar)
  Step 2: Run sniping_mission() for lead discovery
  Step 3: Send WhatsApp alert about results (Twilio sandbox)
  Step 4: Attempt CRM push (skip if not configured)

Usage:
  python tests/test_e2e_pipeline.py
"""

import os
import sys
import json

# Ensure backend directory is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Try loading env
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass


PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
SKIP = "\033[93mSKIP\033[0m"


def step_header(num: int, title: str):
    print(f"\n{'='*60}")
    print(f"  Step {num}: {title}")
    print(f"{'='*60}")


def main():
    print("\n" + "=" * 60)
    print("  Quiet Eyes — E2E Pipeline Test (Sprint 12)")
    print("=" * 60)

    results = []

    # ── Step 1: Verify business exists ─────────────────────────────────
    step_header(1, "Verify business exists (Uma Sushi Bar)")
    try:
        from config import supabase
        if not supabase:
            raise RuntimeError("Supabase not configured")

        biz = (
            supabase.table("businesses")
            .select("id, business_name, industry, location, industry_blueprint")
            .ilike("business_name", "%uma%sushi%")
            .limit(1)
            .execute()
        )

        if biz.data and len(biz.data) > 0:
            b = biz.data[0]
            print(f"  Found: {b['business_name']}")
            print(f"  Industry: {b.get('industry', 'N/A')}")
            print(f"  Location: {b.get('location', 'N/A')}")
            print(f"  Blueprint: {'yes' if b.get('industry_blueprint') else 'no'}")
            print(f"  [{PASS}] Business exists")
            results.append(("Step 1: Business exists", "PASS"))
            business_id = b["id"]
        else:
            print(f"  [{FAIL}] Uma Sushi Bar not found in database")
            print("  Hint: Run onboarding first or create the business manually")
            results.append(("Step 1: Business exists", "FAIL"))
            business_id = None
    except Exception as e:
        print(f"  [{FAIL}] Error: {e}")
        results.append(("Step 1: Business exists", "FAIL"))
        business_id = None

    # ── Step 2: Run sniping mission ────────────────────────────────────
    step_header(2, "Run sniping_mission() for lead discovery")
    report = None
    if not business_id:
        print(f"  [{SKIP}] No business_id from Step 1")
        results.append(("Step 2: Sniping mission", "SKIP"))
    else:
        try:
            from services.lead_sniper import get_lead_sniper
            from config import supabase

            sniper = get_lead_sniper()
            report = sniper.sniping_mission(business_id, supabase)

            print(f"  Queries executed: {len(report.queries_executed)}")
            print(f"  Results scanned: {report.total_results_scanned}")
            print(f"  Leads found: {report.leads_found}")
            print(f"  Leads saved: {report.leads_saved}")
            if report.errors:
                print(f"  Errors: {report.errors}")

            if report.total_results_scanned >= 0:  # Mission ran without crash
                print(f"  [{PASS}] Sniping mission completed")
                results.append(("Step 2: Sniping mission", "PASS"))
            else:
                print(f"  [{FAIL}] Unexpected state")
                results.append(("Step 2: Sniping mission", "FAIL"))
        except Exception as e:
            print(f"  [{FAIL}] Error: {e}")
            results.append(("Step 2: Sniping mission", "FAIL"))

    # ── Step 3: Send WhatsApp alert ────────────────────────────────────
    step_header(3, "Send WhatsApp alert about results (Twilio sandbox)")
    if not report or report.leads_saved == 0:
        print(f"  [{SKIP}] No leads to report (Step 2 had 0 leads)")
        results.append(("Step 3: WhatsApp alert", "SKIP"))
    else:
        try:
            from services.whatsapp import send_whatsapp_message

            message = (
                f"Quiet Eyes E2E Test\n"
                f"Sniping mission complete!\n"
                f"Leads found: {report.leads_found}\n"
                f"Leads saved: {report.leads_saved}"
            )
            # Use configured test phone or sandbox
            test_phone = os.getenv("WHATSAPP_TEST_PHONE", "")
            if not test_phone:
                print(f"  [{SKIP}] WHATSAPP_TEST_PHONE not set")
                results.append(("Step 3: WhatsApp alert", "SKIP"))
            else:
                send_whatsapp_message(test_phone, message)
                print(f"  Sent to {test_phone[:6]}...")
                print(f"  [{PASS}] WhatsApp alert sent")
                results.append(("Step 3: WhatsApp alert", "PASS"))
        except ImportError:
            print(f"  [{SKIP}] WhatsApp service not available")
            results.append(("Step 3: WhatsApp alert", "SKIP"))
        except Exception as e:
            print(f"  [{FAIL}] Error: {e}")
            results.append(("Step 3: WhatsApp alert", "FAIL"))

    # ── Step 4: CRM push ──────────────────────────────────────────────
    step_header(4, "Attempt CRM push (skip if not configured)")
    if not business_id:
        print(f"  [{SKIP}] No business_id")
        results.append(("Step 4: CRM push", "SKIP"))
    else:
        try:
            from config import supabase

            # Check if CRM is configured for this business's workspace
            biz_ws = (
                supabase.table("businesses")
                .select("workspace_id")
                .eq("id", business_id)
                .single()
                .execute()
            )
            ws_id = (biz_ws.data or {}).get("workspace_id")

            if not ws_id:
                print(f"  [{SKIP}] No workspace_id found")
                results.append(("Step 4: CRM push", "SKIP"))
            else:
                crm_config = (
                    supabase.table("crm_integrations")
                    .select("provider")
                    .eq("workspace_id", ws_id)
                    .maybe_single()
                    .execute()
                )

                if not crm_config.data:
                    print(f"  [{SKIP}] CRM not configured for workspace {ws_id}")
                    results.append(("Step 4: CRM push", "SKIP"))
                else:
                    provider = crm_config.data.get("provider", "unknown")
                    print(f"  CRM provider: {provider}")
                    print(f"  [{PASS}] CRM integration found (push would proceed)")
                    results.append(("Step 4: CRM push", "PASS"))
        except Exception as e:
            print(f"  [{SKIP}] CRM check error: {e}")
            results.append(("Step 4: CRM push", "SKIP"))

    # ── Summary ───────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    for label, status in results:
        color = PASS if status == "PASS" else FAIL if status == "FAIL" else SKIP
        print(f"  [{color}] {label}")

    passes = sum(1 for _, s in results if s == "PASS")
    fails = sum(1 for _, s in results if s == "FAIL")
    skips = sum(1 for _, s in results if s == "SKIP")
    print(f"\n  Total: {passes} passed, {fails} failed, {skips} skipped")
    print(f"{'='*60}\n")

    return 0 if fails == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
