"""
Seed realistic Hebrew test data into Supabase for development.

Usage:
    cd backend && python seed_data.py --user-id <UUID>
    cd backend && python seed_data.py --user-id <UUID> --service-key <KEY>

Inserts competitors, leads, intelligence events, and knowledge base
entries for the user's business.
"""

import argparse
import os
import uuid
import sys
from datetime import datetime, timezone, timedelta

from dotenv import load_dotenv

load_dotenv()


def main():
    parser = argparse.ArgumentParser(description="Seed test data for a user")
    parser.add_argument("--user-id", required=True, help="User UUID from Supabase auth")
    parser.add_argument("--service-key", default=None, help="Supabase service role key (bypasses RLS)")
    args = parser.parse_args()
    user_id = args.user_id

    # Build Supabase client — prefer service role key if provided
    service_key = args.service_key or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if service_key:
        from supabase import create_client
        supabase_url = os.getenv("SUPABASE_URL")
        if not supabase_url:
            print("ERROR: SUPABASE_URL not set in .env")
            sys.exit(1)
        supabase = create_client(supabase_url, service_key)
        print("Using service role key (bypasses RLS)")
    else:
        from config import supabase as _sb
        supabase = _sb

    if not supabase:
        print("ERROR: Supabase client not configured. Check .env")
        sys.exit(1)

    # ── Step 1: Look up existing business ──
    print(f"Looking up business for user {user_id}...")
    biz_result = (
        supabase.table("businesses")
        .select("*")
        .eq("user_id", user_id)
        .limit(1)
        .execute()
    )

    if not biz_result.data:
        print("ERROR: No business found for this user. Run onboarding first.")
        sys.exit(1)

    business = biz_result.data[0]
    business_id = business["id"]
    biz_name = business.get("business_name", "Unknown")
    print(f"Found business: {biz_name} (ID: {business_id})")

    # ── Step 2a: Clean up duplicate competitors ──
    print("\nCleaning duplicate competitors...")
    try:
        existing = supabase.table("competitors").select("id, name, place_id, created_at").eq("business_id", business_id).order("created_at", desc=True).execute()
        if existing.data:
            seen_keys = {}
            ids_to_delete = []
            for c in existing.data:
                key = (c.get("place_id") or c.get("name", "")).strip().lower()
                if key in seen_keys:
                    ids_to_delete.append(c["id"])
                else:
                    seen_keys[key] = c["id"]
            if ids_to_delete:
                for cid in ids_to_delete:
                    supabase.table("competitors").delete().eq("id", cid).execute()
                print(f"  Removed {len(ids_to_delete)} duplicate competitors")
            else:
                print("  No duplicates found")
    except Exception as e:
        print(f"  WARNING: dedup failed: {e}")

    # ── Step 2b: Insert Competitors ──
    print("\nInserting competitors...")
    competitors = [
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "name": "סושי קנאל - זכרון יעקב",
            "description": "מסעדת סושי ותפריט יפני מלא, משלוחים וישיבה",
            "address": "רחוב המייסדים 22, זכרון יעקב",
            "latitude": 32.5760,
            "longitude": 34.9520,
            "google_rating": 4.6,
            "google_reviews_count": 312,
            "perceived_threat_level": "High",
            "identified_weakness": "זמני המתנה ארוכים בשעות שיא",
            "website": "https://sushi-canal.co.il",
            "phone": "04-6291234",
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "name": "יאמטו סושי בר",
            "description": "סושי בר פרימיום עם שף יפני, ישיבה במקום בלבד",
            "address": "רחוב הנדיב 8, זכרון יעקב",
            "latitude": 32.5710,
            "longitude": 34.9560,
            "google_rating": 4.4,
            "google_reviews_count": 189,
            "perceived_threat_level": "High",
            "identified_weakness": "מחירים גבוהים, אין משלוחים",
            "website": "https://yamato-sushi.co.il",
            "phone": "04-6295678",
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "name": "מוסקיטו סושי",
            "description": "סושי זול ומהיר, דגש על משלוחים",
            "address": "שדרות בנימין 15, זכרון יעקב",
            "latitude": 32.5780,
            "longitude": 34.9490,
            "google_rating": 4.2,
            "google_reviews_count": 97,
            "perceived_threat_level": "Medium",
            "identified_weakness": "איכות לא עקבית לפי ביקורות",
            "website": None,
            "phone": "04-6291111",
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "name": "אוקינאווה - מטבח יפני",
            "description": "מסעדת שף יפנית עם תפריט טעימות ואירועים",
            "address": "רחוב היין 3, זכרון יעקב",
            "latitude": 32.5725,
            "longitude": 34.9580,
            "google_rating": 4.7,
            "google_reviews_count": 421,
            "perceived_threat_level": "High",
            "identified_weakness": "מחיר ממוצע גבוה, לא מתאים לתקציב",
            "website": "https://okinawa-rest.co.il",
            "phone": "04-6299999",
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "name": "טמפורה הכרמל",
            "description": "דוכן סושי וטמפורה, בעיקר טייקאווי",
            "address": "רחוב ז'בוטינסקי 30, זכרון יעקב",
            "latitude": 32.5695,
            "longitude": 34.9510,
            "google_rating": 3.9,
            "google_reviews_count": 54,
            "perceived_threat_level": "Low",
            "identified_weakness": "מיקום לא מרכזי, נוכחות דיגיטלית חלשה",
            "website": None,
            "phone": "04-6292222",
        },
    ]

    try:
        supabase.table("competitors").upsert(competitors, on_conflict="business_id,place_id").execute()
        print(f"  Upserted {len(competitors)} competitors")
    except Exception as e:
        # Fallback to simple insert if upsert constraint doesn't exist
        try:
            supabase.table("competitors").insert(competitors).execute()
            print(f"  Inserted {len(competitors)} competitors")
        except Exception as e2:
            print(f"  WARNING: competitors insert failed: {e2}")

    # ── Step 3: Insert Leads ──
    print("\nInserting leads...")
    now = datetime.now(timezone.utc)
    leads = [
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": "google",
            "summary": "ביקורת שלילית אצל מתחרה — הזדמנות! לקוח של יאמטו סושי בר כתב ביקורת 2 כוכבים על אוכל קר.",
            "original_text": "ההזמנה הגיעה קרה והאורז היה יבש. לא אזמין שוב מיאמטו.",
            "source_url": "https://maps.google.com",
            "search_query": "סושי זכרון יעקב ביקורות",
            "relevance_score": 0.92,
            "status": "new",
            "created_at": (now - timedelta(hours=2)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": "facebook",
            "summary": "פוסט בקבוצת 'אוכל בזכרון' — מחפשים סושי לקייטרינג חתונה. 45 תגובות.",
            "original_text": "מישהו מכיר סושי טוב באזור זכרון? חתונה בשבוע הבא ומחפש קייטרינג",
            "source_url": "https://facebook.com/groups/food-zichron",
            "search_query": "סושי קייטרינג זכרון יעקב",
            "relevance_score": 0.88,
            "status": "new",
            "created_at": (now - timedelta(hours=5)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": "google",
            "summary": "עלייה של 35% בחיפוש 'סושי משלוחים זכרון יעקב' בגוגל. מומלץ לחזק SEO מקומי.",
            "original_text": "Google Trends: +35% בשבוע האחרון למונח 'סושי משלוחים זכרון יעקב'",
            "source_url": None,
            "search_query": "סושי משלוחים זכרון יעקב",
            "relevance_score": 0.75,
            "status": "new",
            "created_at": (now - timedelta(hours=12)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": "instagram",
            "summary": "אינפלואנסרית @zichron_foodie (12K עוקבים) מחפשת שת\"פ עם מסעדות יפניות. הזדמנות חשיפה.",
            "original_text": "מחפשת מסעדות יפניות לשיתוף פעולה באזור הכרמל! DM me",
            "source_url": "https://instagram.com/zichron_foodie",
            "search_query": "אינפלואנסרים אוכל זכרון יעקב",
            "relevance_score": 0.82,
            "status": "new",
            "created_at": (now - timedelta(hours=18)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": "google",
            "summary": "סושי קנאל קיבל 3 ביקורות של 1-2 כוכבים השבוע על זמני המתנה ארוכים. הזדמנות להדגיש שירות מהיר.",
            "original_text": "חיכיתי שעה למשלוח. לא מקובל. עובר למתחרה.",
            "source_url": "https://maps.google.com",
            "search_query": "סושי קנאל זכרון יעקב ביקורות",
            "relevance_score": 0.90,
            "status": "new",
            "created_at": (now - timedelta(days=1)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": "other",
            "summary": "פסטיבל אוכל רחוב מתוכנן ליום שישי ברחוב המייסדים. הזדמנות לדוכן זמני או חלוקת פליירים.",
            "original_text": "פסטיבל אוכל רחוב — זכרון יעקב, יום שישי 10:00-16:00",
            "source_url": None,
            "search_query": "אירועי אוכל זכרון יעקב",
            "relevance_score": 0.68,
            "status": "new",
            "created_at": (now - timedelta(days=1, hours=6)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": "google",
            "summary": "5 ביקורות חדשות בגוגל שלא נענו. מענה מהיר משפר SEO מקומי ודירוג.",
            "original_text": "5 ביקורות ממתינות למענה בכרטיס Google Business",
            "source_url": None,
            "search_query": "Uma Sushi Bar reviews",
            "relevance_score": 0.85,
            "status": "new",
            "created_at": (now - timedelta(days=2)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": "facebook",
            "summary": "פוסט ויראלי בקבוצת 'זכרון יעקב שכנים' עם 120 לייקים שואל על סושי. 30 תגובות — רוב ממליצות על מתחרים.",
            "original_text": "מישהו יכול להמליץ על סושי באמת טוב בזכרון? כבר ניסיתי הכל...",
            "source_url": "https://facebook.com/groups/zichron-neighbors",
            "search_query": "סושי מומלץ זכרון יעקב",
            "relevance_score": 0.87,
            "status": "new",
            "created_at": (now - timedelta(days=2, hours=12)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": "google",
            "summary": "מילת מפתח חדשה עולה: 'סושי בריא זכרון יעקב'. אין מתחרים שמתמקדים בה — הזדמנות SEO.",
            "original_text": "Google Search Console: new keyword emerging 'סושי בריא זכרון יעקב'",
            "source_url": None,
            "search_query": "סושי בריא זכרון יעקב",
            "relevance_score": 0.71,
            "status": "new",
            "created_at": (now - timedelta(days=3)).isoformat(),
        },
        {
            "id": str(uuid.uuid4()),
            "business_id": business_id,
            "platform": "other",
            "summary": "כתבה ב'חדשות זכרון' על עליית הביקוש לסושי פרימיום. אתם לא מוזכרים — הזדמנות PR.",
            "original_text": "מגמת הסושי הפרימיום מגיעה לזכרון יעקב — כתבה מיוחדת",
            "source_url": "https://zichron-news.co.il",
            "search_query": "סושי פרימיום זכרון יעקב חדשות",
            "relevance_score": 0.65,
            "status": "new",
            "created_at": (now - timedelta(days=4)).isoformat(),
        },
    ]

    try:
        supabase.table("leads_discovered").insert(leads).execute()
        print(f"  Inserted {len(leads)} leads")
    except Exception as e:
        print(f"  WARNING: leads insert failed: {e}")

    # ── Step 4: Insert Intelligence Events (skip if table doesn't exist) ──
    print("\nInserting intelligence events...")
    events = [
        {
            "business_id": business_id,
            "event_type": "competitor_change",
            "title": "אוקינאווה עדכנו תפריט חדש",
            "description": "אוקינאווה הוסיפו 8 מנות חדשות לתפריט כולל קומבו משפחתי ב-199 ש\"ח",
            "severity": "medium",
            "source": "Google Maps",
            "is_read": False,
            "created_at": (now - timedelta(hours=3)).isoformat(),
        },
        {
            "business_id": business_id,
            "event_type": "lead_found",
            "title": "ליד חם: קייטרינג לאירוע",
            "description": "זוהתה פנייה בפייסבוק לקייטרינג סושי לאירוע של 80 איש",
            "severity": "high",
            "source": "Facebook",
            "is_read": False,
            "created_at": (now - timedelta(hours=6)).isoformat(),
        },
        {
            "business_id": business_id,
            "event_type": "price_alert",
            "title": "סושי קנאל הורידו מחירים ב-15%",
            "description": "סושי קנאל עדכנו מחירים — ירידה ממוצעת של 15% על תפריט הצהריים",
            "severity": "high",
            "source": "Price Monitor",
            "is_read": False,
            "created_at": (now - timedelta(hours=10)).isoformat(),
        },
        {
            "business_id": business_id,
            "event_type": "scan_completed",
            "title": "סריקת שוק הושלמה בהצלחה",
            "description": "נסרקו 5 מתחרים, 23 ביקורות חדשות, 4 שינויי מחיר",
            "severity": "low",
            "source": "System",
            "is_read": True,
            "created_at": (now - timedelta(days=1)).isoformat(),
        },
        {
            "business_id": business_id,
            "event_type": "radar_alert",
            "title": "מתחרה חדש באזור!",
            "description": "זוהה עסק חדש: 'רול אנד רוק סושי' נפתח ברחוב המייסדים 12",
            "severity": "medium",
            "source": "Google Maps",
            "is_read": False,
            "created_at": (now - timedelta(days=1, hours=8)).isoformat(),
        },
    ]

    try:
        supabase.table("intelligence_events").insert(events).execute()
        print(f"  Inserted {len(events)} intelligence events")
    except Exception as e:
        print(f"  SKIPPED: intelligence_events (table may not exist): {e}")

    # ── Done ──
    print(f"\nSeed complete for business '{biz_name}'!")
    print(f"  - {len(competitors)} competitors")
    print(f"  - {len(leads)} leads")
    print(f"  - {len(events)} intelligence events (if table exists)")


if __name__ == "__main__":
    main()
