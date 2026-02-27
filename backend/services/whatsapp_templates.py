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
