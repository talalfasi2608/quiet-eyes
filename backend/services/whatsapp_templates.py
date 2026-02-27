"""
WhatsApp Message Templates.

All template functions return a formatted Hebrew string ready for
send_whatsapp_message(). Placeholders are filled via keyword arguments.
"""

import os
from datetime import datetime, timezone

# Base URL for links back to the platform
_FRONTEND_URL = os.getenv("FRONTEND_URL", "https://app.quieteyes.co.il")


def morning_summary(
    business_name: str,
    hot_leads: int = 0,
    competitor_changes: int = 0,
    recommended_action: str = "",
) -> str:
    today = datetime.now(timezone.utc).strftime("%d/%m/%Y")
    action_line = f"⚡ הפעולה המומלצת: {recommended_action}" if recommended_action else ""
    return (
        f"☀️ בוקר טוב {business_name}!\n"
        f"סיכום בוקר לעסק שלך — {today}\n"
        f"\n"
        f"🎯 לידים חמים היום: {hot_leads}\n"
        f"👁️ שינויים אצל מתחרים: {competitor_changes}\n"
        f"{action_line}\n"
        f"\n"
        f"לפרטים מלאים: {_FRONTEND_URL}/dashboard\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes | מודיעין עסקי"
    ).strip()


def new_hot_lead(
    search_query: str = "",
    relevance_score: int = 0,
    source: str = "",
    quote: str = "",
    recommended_action: str = "",
    lead_id: str = "",
) -> str:
    quote_line = f"\n'{quote}'" if quote else ""
    action_line = f"\nפעולה מומלצת: {recommended_action}" if recommended_action else ""
    link = f"{_FRONTEND_URL}/dashboard/sniper"
    if lead_id:
        link += f"?lead={lead_id}"
    return (
        f"🎯 ליד חם חדש!\n"
        f"\n"
        f"מישהו מחפש: '{search_query}'\n"
        f"רלוונטיות: {relevance_score}/100\n"
        f"מקור: {source}"
        f"{quote_line}"
        f"\n"
        f"{action_line}\n"
        f"👉 {link}\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()


def competitor_change(
    competitor_name: str,
    change_description: str,
    recommendation: str = "",
) -> str:
    rec_line = f"\n💡 המלצה: {recommendation}" if recommendation else ""
    return (
        f"👁️ שינוי אצל מתחרה!\n"
        f"\n"
        f"{competitor_name} עדכן:\n"
        f"{change_description}"
        f"{rec_line}\n"
        f"\n"
        f"👉 {_FRONTEND_URL}/dashboard/intelligence\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()


def new_competitor(
    competitor_name: str,
    address: str = "",
    distance_km: float = 0,
    business_type: str = "",
    rating: str = "",
    ai_insight: str = "",
) -> str:
    rating_line = f"דירוג ראשוני: {rating}\n" if rating else ""
    insight_line = f"\n💡 {ai_insight}" if ai_insight else ""
    return (
        f"🆕 עסק חדש באזורך!\n"
        f"\n"
        f"{competitor_name} נפתח ב{address}\n"
        f"מרחק ממך: {distance_km:.1f} ק״מ\n"
        f"סוג: {business_type}\n"
        f"{rating_line}"
        f"{insight_line}\n"
        f"\n"
        f"👉 {_FRONTEND_URL}/dashboard/landscape\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()


def weekly_report(
    business_name: str,
    week_range: str = "",
    health_score: int = 0,
    leads_found: int = 0,
    competitor_changes: int = 0,
    new_businesses: int = 0,
    pdf_link: str = "",
) -> str:
    download = pdf_link or f"{_FRONTEND_URL}/dashboard/reports"
    return (
        f"📊 הדוח השבועי שלך מוכן!\n"
        f"\n"
        f"עסק: {business_name}\n"
        f"שבוע: {week_range}\n"
        f"\n"
        f"📈 ציון בריאות: {health_score}/100\n"
        f"🎯 לידים שנמצאו: {leads_found}\n"
        f"👁️ שינויים אצל מתחרים: {competitor_changes}\n"
        f"🆕 עסקים חדשים: {new_businesses}\n"
        f"\n"
        f"👉 הורד דוח מלא: {download}\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()


def test_message(business_name: str = "העסק שלך") -> str:
    """Test message to verify WhatsApp integration."""
    return (
        f"✅ הודעת בדיקה מ-Quieteyes!\n"
        f"\n"
        f"שלום, {business_name}.\n"
        f"ההתראות בוואטסאפ מחוברות ועובדות.\n"
        f"תקבל התראות על לידים, מתחרים ועדכונים חשובים ישירות לכאן.\n"
        f"\n"
        f"👉 {_FRONTEND_URL}/dashboard/settings\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes | מודיעין עסקי"
    ).strip()


# ═══════════════════════════════════════════════════════════════
# Trial Conversion Templates
# ═══════════════════════════════════════════════════════════════

def trial_day1_welcome(
    name: str,
    competitors_found: int = 0,
    leads_found: int = 0,
) -> str:
    return (
        f"👋 היי {name}!\n"
        f"\n"
        f"ברוך הבא ל-Quieteyes 🎉\n"
        f"\n"
        f"הסריקה הראשונה שלך הושלמה.\n"
        f"מצאנו {competitors_found} מתחרים ו-{leads_found} לידים.\n"
        f"\n"
        f"⏰ יש לך 14 יום חינם להכיר את הפלטפורמה.\n"
        f"\n"
        f"💡 טיפ ליום הראשון:\n"
        f"כנס לעמוד הלידים וראה מי מחפש\n"
        f"את השירות שלך עכשיו.\n"
        f"\n"
        f"👉 {_FRONTEND_URL}/dashboard/sniper\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()


def trial_day3_value(
    name: str,
    leads_found: int = 0,
    competitor_changes: int = 0,
    new_businesses: int = 0,
    insight: str = "",
) -> str:
    insight_line = f"\n💡 הכי מעניין השבוע:\n{insight}" if insight else ""
    return (
        f"📊 3 ימים עם Quieteyes — הנה מה שמצאנו:\n"
        f"\n"
        f"🎯 לידים חמים: {leads_found}\n"
        f"👁️ שינויים אצל מתחרים: {competitor_changes}\n"
        f"🆕 עסקים חדשים באזורך: {new_businesses}"
        f"{insight_line}\n"
        f"\n"
        f"עוד 11 יום בניסיון החינמי שלך.\n"
        f"\n"
        f"👉 {_FRONTEND_URL}/dashboard\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()


def trial_day7_halfway(
    name: str,
    business_name: str,
    leads_found: int = 0,
    competitors_tracked: int = 0,
    changes_detected: int = 0,
    alerts_sent: int = 0,
    best_insight: str = "",
) -> str:
    insight_line = f"\n💡 התובנה הכי חשובה השבוע:\n{best_insight}" if best_insight else ""
    return (
        f"🎯 שבוע ראשון — הנה הסיכום שלך:\n"
        f"\n"
        f"עסק: {business_name}\n"
        f"תקופה: 7 ימים\n"
        f"\n"
        f"📈 מה מצאנו בשבילך:\n"
        f"- {leads_found} לידים חמים\n"
        f"- {competitors_tracked} מתחרים במעקב\n"
        f"- {changes_detected} שינויים שזוהו\n"
        f"- {alerts_sent} התראות נשלחו"
        f"{insight_line}\n"
        f"\n"
        f"⏰ נותרו לך 7 ימים בניסיון החינמי.\n"
        f"\n"
        f"השאלה היא לא אם Quieteyes מביאה ערך —\n"
        f"השאלה היא כמה ערך אתה רוצה לקבל.\n"
        f"\n"
        f"👉 ראה את תוכניות המנוי: {_FRONTEND_URL}/dashboard/billing\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()


def trial_day12_urgency(
    name: str,
    leads_found: int = 0,
    competitor_changes: int = 0,
    health_score: int = 0,
) -> str:
    return (
        f"⚠️ נותרו לך 2 ימים בניסיון החינמי\n"
        f"\n"
        f"{name}, הנה מה שמצאנו עבורך ב-12 הימים האחרונים:\n"
        f"\n"
        f"🎯 {leads_found} לידים חמים שזוהו\n"
        f"👁️ {competitor_changes} שינויים אצל המתחרים\n"
        f"📊 ציון בריאות השוק: {health_score}/100\n"
        f"\n"
        f"אם לא תשדרג — תפסיק לקבל:\n"
        f"❌ התראות וואטסאפ\n"
        f"❌ סריקות לידים אוטומטיות\n"
        f"❌ מעקב מתחרים\n"
        f"\n"
        f"התוכנית הכי פופולרית: PRO ב-₪299/חודש\n"
        f"= פחות מ-₪10 ליום למודיעין עסקי מלא\n"
        f"\n"
        f"👉 שדרג עכשיו: {_FRONTEND_URL}/dashboard/billing\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()


def trial_day13_last_chance(
    name: str,
) -> str:
    return (
        f"⏰ מחר הניסיון שלך מסתיים\n"
        f"\n"
        f"{name}, מחר החשבון שלך\n"
        f"עובר למצב חינמי מוגבל.\n"
        f"\n"
        f"מה תפסיד:\n"
        f"❌ התראות וואטסאפ יפסיקו\n"
        f"❌ סריקות לידים: 3 בחודש (במקום 100)\n"
        f"❌ מעקב מתחרים: 3 בלבד (במקום 25)\n"
        f"\n"
        f"מה תשמור:\n"
        f"✅ כל הנתונים שנאספו\n"
        f"✅ גישה לדשבורד (מוגבל)\n"
        f"\n"
        f"💡 הצעה אחרונה:\n"
        f"שדרג היום ותקבל חודש ראשון ב-₪99\n"
        f"(במקום ₪299 לתוכנית PRO)\n"
        f"\n"
        f"קוד: UPGRADE99 — בתוקף עד חצות\n"
        f"\n"
        f"👉 {_FRONTEND_URL}/dashboard/billing\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()


def trial_day14_expired(
    name: str,
) -> str:
    return (
        f"🔔 הניסיון החינמי שלך הסתיים היום\n"
        f"\n"
        f"{name}, 14 ימי הניסיון הסתיימו.\n"
        f"\n"
        f"הפלטפורמה עברה למצב חינמי —\n"
        f"חלק מהיכולות הושבתו.\n"
        f"\n"
        f"מה עצרנו:\n"
        f"⏸️ התראות וואטסאפ\n"
        f"⏸️ סריקות לידים אוטומטיות\n"
        f"⏸️ מעקב מלא אחרי מתחרים\n"
        f"\n"
        f"כדי להמשיך לקבל מודיעין עסקי מלא:\n"
        f"\n"
        f"👉 שדרג עכשיו: {_FRONTEND_URL}/dashboard/billing\n"
        f"\n"
        f"יש שאלות? ענה להודעה הזו ישירות.\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()


def trial_day21_winback(
    name: str,
    leads_missed: int = 0,
) -> str:
    return (
        f"👋 {name}, עדיין חושב?\n"
        f"\n"
        f"מאז שהניסיון שלך הסתיים\n"
        f"מצאנו עוד {leads_missed} לידים חמים באזורך\n"
        f"שהלכו למתחרים שלך.\n"
        f"\n"
        f"אנחנו רוצים שתצליח.\n"
        f"לכן — הצעה חד פעמית:\n"
        f"\n"
        f"חודש PRO ב-₪149 (50% הנחה)\n"
        f"לא יחזור על עצמו.\n"
        f"\n"
        f"קוד: WINBACK50\n"
        f"בתוקף ל-48 שעות.\n"
        f"\n"
        f"👉 {_FRONTEND_URL}/dashboard/billing\n"
        f"━━━━━━━━━━━━━\n"
        f"Quieteyes"
    ).strip()
