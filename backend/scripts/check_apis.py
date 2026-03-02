"""
Quieteyes — API Key Checker & Live Tester
Run: cd backend && python scripts/check_apis.py
"""

import os
import sys
import json

# Load .env
from dotenv import load_dotenv
load_dotenv()

print("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("  Quieteyes — API Key Checker")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

# ── Step 1: Check env vars exist ──

REQUIRED = [
    ("ANTHROPIC_API_KEY", "AI (Claude)"),
    ("SUPABASE_URL", "Database URL"),
    ("SUPABASE_KEY", "Database Key"),
    ("SUPABASE_SERVICE_ROLE_KEY", "Database Service Key"),
    ("GOOGLE_API_KEY", "Google Places"),
    ("APIFY_API_KEY", "Apify"),
    ("SERPAPI_API_KEY", "SerpAPI"),
    ("TAVILY_API_KEY", "Tavily"),
]

OPTIONAL = [
    ("GREEN_API_INSTANCE_ID", "WhatsApp Green API"),
    ("GREEN_API_TOKEN", "WhatsApp Green API Token"),
    ("TWILIO_ACCOUNT_SID", "Twilio WhatsApp"),
    ("TWILIO_AUTH_TOKEN", "Twilio Auth"),
    ("ADMIN_PHONE", "Admin Phone"),
    ("ADMIN_EMAIL", "Admin Email"),
]

all_good = True

for key, label in REQUIRED:
    val = os.getenv(key, "").strip()
    if val:
        print(f"  \u2705 {label:.<30} {val[:12]}...")
    else:
        print(f"  \u274c {label:.<30} MISSING")
        all_good = False

print("\n  --- Optional ---")
for key, label in OPTIONAL:
    val = os.getenv(key, "").strip()
    if val:
        print(f"  \u2705 {label:.<30} {val[:12]}...")
    else:
        print(f"  \u26a0\ufe0f  {label:.<30} not set")

if not all_good:
    print("\n\u274c Required keys missing. Fix .env and re-run.")
    sys.exit(1)

print("\n\u2705 All required keys present. Testing APIs...\n")

# ── Step 2: Live API tests ──

import httpx

results = {}


def test_anthropic():
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        resp = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=10,
            messages=[{"role": "user", "content": "Reply with only: OK"}],
        )
        text = resp.content[0].text if resp.content else ""
        print(f"  \u2705 Anthropic (Claude) — {text.strip()}")
        return True
    except Exception as e:
        print(f"  \u274c Anthropic — {e}")
        return False


def test_google_places():
    try:
        key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_PLACES_API_KEY")
        url = "https://maps.googleapis.com/maps/api/place/nearbysearch/json"
        params = {
            "location": "32.0853,34.7818",
            "radius": "1000",
            "keyword": "restaurant",
            "language": "he",
            "key": key,
        }
        resp = httpx.get(url, params=params, timeout=10)
        data = resp.json()
        status = data.get("status")
        if status in ("OK", "ZERO_RESULTS"):
            count = len(data.get("results", []))
            print(f"  \u2705 Google Places — {count} results")
            return True
        else:
            print(f"  \u274c Google Places — {status}: {data.get('error_message', '')}")
            return False
    except Exception as e:
        print(f"  \u274c Google Places — {e}")
        return False


def test_google_geocoding():
    try:
        key = os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_PLACES_API_KEY")
        url = "https://maps.googleapis.com/maps/api/geocode/json"
        params = {"address": "תל אביב, ישראל", "language": "he", "key": key}
        resp = httpx.get(url, params=params, timeout=10)
        data = resp.json()
        if data.get("status") == "OK":
            loc = data["results"][0]["geometry"]["location"]
            print(f"  \u2705 Google Geocoding — ({loc['lat']:.2f}, {loc['lng']:.2f})")
            return True
        else:
            print(f"  \u274c Google Geocoding — {data.get('status')}")
            return False
    except Exception as e:
        print(f"  \u274c Google Geocoding — {e}")
        return False


def test_apify():
    try:
        token = os.getenv("APIFY_API_KEY") or os.getenv("APIFY_API_TOKEN")
        resp = httpx.get(
            "https://api.apify.com/v2/users/me",
            headers={"Authorization": f"Bearer {token}"},
            timeout=10,
        )
        data = resp.json()
        username = data.get("data", {}).get("username")
        if username:
            print(f"  \u2705 Apify — user: {username}")
            return True
        else:
            print(f"  \u274c Apify — {data}")
            return False
    except Exception as e:
        print(f"  \u274c Apify — {e}")
        return False


def test_serpapi():
    try:
        key = os.getenv("SERPAPI_API_KEY") or os.getenv("SERPAPI_KEY")
        resp = httpx.get(f"https://serpapi.com/account?api_key={key}", timeout=10)
        data = resp.json()
        if data.get("account_email"):
            left = data.get("total_searches_left", "?")
            print(f"  \u2705 SerpAPI — {data['account_email']} ({left} searches left)")
            return True
        else:
            print(f"  \u274c SerpAPI — {data.get('error', data)}")
            return False
    except Exception as e:
        print(f"  \u274c SerpAPI — {e}")
        return False


def test_tavily():
    try:
        key = os.getenv("TAVILY_API_KEY")
        resp = httpx.post(
            "https://api.tavily.com/search",
            json={"query": "test", "max_results": 1},
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {key}",
            },
            timeout=15,
        )
        data = resp.json()
        if data.get("results") is not None:
            print(f"  \u2705 Tavily — {len(data['results'])} result(s)")
            return True
        else:
            print(f"  \u274c Tavily — {data.get('error', data)}")
            return False
    except Exception as e:
        print(f"  \u274c Tavily — {e}")
        return False


def test_supabase():
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        sb = create_client(url, key)
        # Try a simple query
        result = sb.table("businesses").select("id").limit(1).execute()
        count = len(result.data) if result.data else 0
        print(f"  \u2705 Supabase DB — connected ({count} business rows sampled)")
        return True
    except Exception as e:
        print(f"  \u274c Supabase DB — {e}")
        return False


def test_green_api():
    instance_id = os.getenv("GREEN_API_INSTANCE_ID", "").strip()
    token = os.getenv("GREEN_API_TOKEN", "").strip()
    if not instance_id or not token:
        print(f"  \u26a0\ufe0f  Green API — not configured (using Twilio instead)")
        return None  # skip, not fail
    try:
        url = f"https://api.green-api.com/waInstance{instance_id}/getStateInstance/{token}"
        resp = httpx.get(url, timeout=10)
        data = resp.json()
        state = data.get("stateInstance")
        if state == "authorized":
            print(f"  \u2705 Green API — WhatsApp connected")
            return True
        else:
            print(f"  \u274c Green API — state: {state}")
            return False
    except Exception as e:
        print(f"  \u274c Green API — {e}")
        return False


# ── Run all tests ──

print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print("  Live API Tests")
print("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

tests = [
    ("Anthropic", test_anthropic),
    ("Google Places", test_google_places),
    ("Google Geocoding", test_google_geocoding),
    ("Apify", test_apify),
    ("SerpAPI", test_serpapi),
    ("Tavily", test_tavily),
    ("Supabase DB", test_supabase),
    ("Green API", test_green_api),
]

passed = 0
failed = 0
skipped = 0

for name, fn in tests:
    try:
        result = fn()
        if result is True:
            passed += 1
        elif result is None:
            skipped += 1
        else:
            failed += 1
    except Exception as e:
        print(f"  \u274c {name} — unexpected error: {e}")
        failed += 1

total = passed + failed
print(f"\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
print(f"  Results: {passed}/{total} passed" + (f", {skipped} skipped" if skipped else ""))
print(f"━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n")

if failed == 0:
    print("All APIs working! Ready to build.")
else:
    print(f"{failed} API(s) failed. Fix before continuing.")
    sys.exit(1)
