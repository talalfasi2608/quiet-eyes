"""
Single source of truth for all plan definitions in Quiet Eyes.

Convention:
  -1   = unlimited
  True/False = boolean gate
  int >= 0   = count limit
"""

PLAN_ORDER = ["free", "starter", "pro", "business"]

PLANS = {
    "free": {
        "name": "Free",
        "name_he": "\u05d7\u05d9\u05e0\u05dd",
        "price_monthly": 0,
        "price_yearly": 0,
        "credits": 10,
        "color": "gray",
        "description": "\u05ea\u05d5\u05db\u05e0\u05d9\u05ea \u05d1\u05e1\u05d9\u05e1\u05d9\u05ea \u05dc\u05d4\u05ea\u05d7\u05dc\u05d4",
        "trial_days": 0,
        "badge": None,
        "features_list": [
            "10 \u05e7\u05e8\u05d3\u05d9\u05d8\u05d9\u05dd \u05dc\u05d7\u05d5\u05d3\u05e9",
            "\u05d3\u05e9\u05d1\u05d5\u05e8\u05d3 \u05d1\u05e1\u05d9\u05e1\u05d9",
            "\u05e4\u05e8\u05d5\u05e4\u05d9\u05dc \u05e2\u05e1\u05e7 \u05d0\u05d7\u05d3",
            "\u05de\u05ea\u05d7\u05e8\u05d4 \u05d0\u05d7\u05d3",
            "\u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05e9\u05d5\u05e7 \u05d1\u05e1\u05d9\u05e1\u05d9\u05d5\u05ea",
        ],
        "limits": {
            # Leads
            "leads_scans_per_month": 3,
            "leads_per_scan": 5,
            "leads_total_stored": 50,
            "leads_export_csv": False,
            # Competitors
            "competitors_tracked": 1,
            "competitor_deep_analysis": False,
            "competitor_price_tracking": False,
            "competitor_job_alerts": False,
            # Intelligence
            "intelligence_scan_per_month": 2,
            "intelligence_history_days": 7,
            "market_alerts": False,
            # AI
            "ai_chat_messages_per_month": 10,
            "ai_advisor_templates": 0,
            "ai_campaign_generator": False,
            "ai_response_generator": False,
            # Reports
            "weekly_report": False,
            "custom_reports": False,
            "reports_history": 0,
            # Automation
            "whatsapp_alerts": False,
            "auto_review_response": False,
            "morning_briefing": False,
            "competitor_alerts_realtime": False,
            # Cities & branches
            "cities": 1,
            "branches": 1,
            # Team
            "team_members": 1,
            # Support & access
            "support_level": "community",
            "api_access": False,
            "dedicated_account_manager": False,
        },
    },
    "starter": {
        "name": "Starter",
        "name_he": "\u05e1\u05d8\u05d0\u05e8\u05d8\u05e8",
        "price_monthly": 149,
        "price_yearly": 1190,
        "credits": 50,
        "color": "blue",
        "description": "\u05dc\u05e2\u05e1\u05e7\u05d9\u05dd \u05e7\u05d8\u05e0\u05d9\u05dd \u05e9\u05e8\u05d5\u05e6\u05d9\u05dd \u05dc\u05d4\u05ea\u05d7\u05d9\u05dc \u05dc\u05e6\u05de\u05d5\u05d7",
        "trial_days": 14,
        "badge": None,
        "features_list": [
            "50 \u05e7\u05e8\u05d3\u05d9\u05d8\u05d9\u05dd \u05dc\u05d7\u05d5\u05d3\u05e9",
            "\u05e2\u05d3 3 \u05de\u05ea\u05d7\u05e8\u05d9\u05dd",
            "30 \u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05dc\u05d9\u05d3\u05d9\u05dd",
            "\u05d3\u05d5\u05d7\u05d5\u05ea AI",
            "\u05e6'\u05d0\u05d8 AI COO",
            "\u05ea\u05d3\u05e8\u05d9\u05da \u05d9\u05d5\u05de\u05d9",
        ],
        "limits": {
            # Leads
            "leads_scans_per_month": 30,
            "leads_per_scan": 15,
            "leads_total_stored": 500,
            "leads_export_csv": True,
            # Competitors
            "competitors_tracked": 3,
            "competitor_deep_analysis": True,
            "competitor_price_tracking": False,
            "competitor_job_alerts": False,
            # Intelligence
            "intelligence_scan_per_month": 10,
            "intelligence_history_days": 30,
            "market_alerts": True,
            # AI
            "ai_chat_messages_per_month": 100,
            "ai_advisor_templates": 3,
            "ai_campaign_generator": False,
            "ai_response_generator": False,
            # Reports
            "weekly_report": True,
            "custom_reports": False,
            "reports_history": 4,
            # Automation
            "whatsapp_alerts": False,
            "auto_review_response": False,
            "morning_briefing": True,
            "competitor_alerts_realtime": False,
            # Cities & branches
            "cities": 1,
            "branches": 1,
            # Team
            "team_members": 1,
            # Support & access
            "support_level": "email",
            "api_access": False,
            "dedicated_account_manager": False,
        },
    },
    "pro": {
        "name": "Pro",
        "name_he": "\u05de\u05e7\u05e6\u05d5\u05e2\u05d9",
        "price_monthly": 299,
        "price_yearly": 2390,
        "credits": 200,
        "color": "cyan",
        "description": "\u05dc\u05e2\u05e1\u05e7\u05d9\u05dd \u05e9\u05e8\u05d5\u05e6\u05d9\u05dd \u05dc\u05e9\u05dc\u05d5\u05d8 \u05d1\u05e9\u05d5\u05e7",
        "trial_days": 14,
        "badge": "\u05d4\u05db\u05d9 \u05e4\u05d5\u05e4\u05d5\u05dc\u05e8\u05d9",
        "features_list": [
            "200 \u05e7\u05e8\u05d3\u05d9\u05d8\u05d9\u05dd \u05dc\u05d7\u05d5\u05d3\u05e9",
            "\u05e2\u05d3 10 \u05de\u05ea\u05d7\u05e8\u05d9\u05dd",
            "200 \u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05dc\u05d9\u05d3\u05d9\u05dd",
            "\u05d3\u05d5\u05d7\u05d5\u05ea AI",
            "\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea WhatsApp",
            "\u05e2\u05d3 3 \u05e2\u05e8\u05d9\u05dd",
            "\u05d0\u05d5\u05d8\u05d5\u05de\u05e6\u05d9\u05d5\u05ea",
            "\u05e2\u05d3 3 \u05d7\u05d1\u05e8\u05d9 \u05e6\u05d5\u05d5\u05ea",
        ],
        "limits": {
            # Leads
            "leads_scans_per_month": 200,
            "leads_per_scan": 30,
            "leads_total_stored": 5000,
            "leads_export_csv": True,
            # Competitors
            "competitors_tracked": 10,
            "competitor_deep_analysis": True,
            "competitor_price_tracking": True,
            "competitor_job_alerts": True,
            # Intelligence
            "intelligence_scan_per_month": 50,
            "intelligence_history_days": 90,
            "market_alerts": True,
            # AI
            "ai_chat_messages_per_month": 500,
            "ai_advisor_templates": 10,
            "ai_campaign_generator": True,
            "ai_response_generator": True,
            # Reports
            "weekly_report": True,
            "custom_reports": True,
            "reports_history": 12,
            # Automation
            "whatsapp_alerts": True,
            "auto_review_response": True,
            "morning_briefing": True,
            "competitor_alerts_realtime": True,
            # Cities & branches
            "cities": 3,
            "branches": 3,
            # Team
            "team_members": 3,
            # Support & access
            "support_level": "priority",
            "api_access": False,
            "dedicated_account_manager": False,
        },
    },
    "business": {
        "name": "Business",
        "name_he": "\u05e2\u05e1\u05e7\u05d9",
        "price_monthly": 599,
        "price_yearly": 4790,
        "credits": -1,
        "color": "amber",
        "description": "\u05dc\u05e2\u05e1\u05e7\u05d9\u05dd \u05d2\u05d3\u05d5\u05dc\u05d9\u05dd \u05e9\u05e8\u05d5\u05e6\u05d9\u05dd \u05d4\u05db\u05dc",
        "trial_days": 14,
        "badge": None,
        "features_list": [
            "\u05e7\u05e8\u05d3\u05d9\u05d8\u05d9\u05dd \u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4",
            "\u05de\u05ea\u05d7\u05e8\u05d9\u05dd \u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4",
            "\u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4",
            "\u05d4\u05db\u05dc \u05d1-Pro",
            "\u05d2\u05d9\u05e9\u05ea API",
            "\u05e0\u05d9\u05d4\u05d5\u05dc \u05e6\u05d5\u05d5\u05ea",
            "\u05dc\u05d5\u05d2\u05d9\u05dd \u05d5\u05d1\u05e7\u05e8\u05d4",
            "\u05de\u05e0\u05d4\u05dc \u05dc\u05e7\u05d5\u05d7 \u05d9\u05d9\u05e2\u05d5\u05d3\u05d9",
        ],
        "limits": {
            # Leads
            "leads_scans_per_month": -1,
            "leads_per_scan": -1,
            "leads_total_stored": -1,
            "leads_export_csv": True,
            # Competitors
            "competitors_tracked": -1,
            "competitor_deep_analysis": True,
            "competitor_price_tracking": True,
            "competitor_job_alerts": True,
            # Intelligence
            "intelligence_scan_per_month": -1,
            "intelligence_history_days": -1,
            "market_alerts": True,
            # AI
            "ai_chat_messages_per_month": -1,
            "ai_advisor_templates": -1,
            "ai_campaign_generator": True,
            "ai_response_generator": True,
            # Reports
            "weekly_report": True,
            "custom_reports": True,
            "reports_history": -1,
            # Automation
            "whatsapp_alerts": True,
            "auto_review_response": True,
            "morning_briefing": True,
            "competitor_alerts_realtime": True,
            # Cities & branches
            "cities": -1,
            "branches": -1,
            # Team
            "team_members": -1,
            # Support & access
            "support_level": "dedicated",
            "api_access": True,
            "dedicated_account_manager": True,
        },
    },
}

# Backward compatibility aliases
PLANS["basic"] = PLANS["starter"]
PLANS["elite"] = PLANS["business"]


# ── Features table for pricing comparison page ──

FEATURES_TABLE = [
    {
        "category": "\u05dc\u05d9\u05d3\u05d9\u05dd",
        "features": [
            {"key": "leads_scans_per_month", "name": "\u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05dc\u05d9\u05d3\u05d9\u05dd \u05dc\u05d7\u05d5\u05d3\u05e9", "free": "3", "starter": "30", "pro": "200", "business": "\u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4"},
            {"key": "leads_per_scan", "name": "\u05dc\u05d9\u05d3\u05d9\u05dd \u05dc\u05e1\u05e8\u05d9\u05e7\u05d4", "free": "5", "starter": "15", "pro": "30", "business": "\u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4"},
            {"key": "leads_total_stored", "name": "\u05dc\u05d9\u05d3\u05d9\u05dd \u05e9\u05de\u05d5\u05e8\u05d9\u05dd", "free": "50", "starter": "500", "pro": "5,000", "business": "\u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4"},
            {"key": "leads_export_csv", "name": "\u05d9\u05d9\u05e6\u05d5\u05d0 CSV", "free": False, "starter": True, "pro": True, "business": True},
        ],
    },
    {
        "category": "\u05de\u05ea\u05d7\u05e8\u05d9\u05dd",
        "features": [
            {"key": "competitors_tracked", "name": "\u05de\u05ea\u05d7\u05e8\u05d9\u05dd \u05e2\u05e7\u05d5\u05d1\u05d9\u05dd", "free": "1", "starter": "3", "pro": "10", "business": "\u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4"},
            {"key": "competitor_deep_analysis", "name": "\u05e0\u05d9\u05ea\u05d5\u05d7 \u05de\u05ea\u05d7\u05e8\u05d9\u05dd \u05de\u05e2\u05de\u05d9\u05e7", "free": False, "starter": True, "pro": True, "business": True},
            {"key": "competitor_price_tracking", "name": "\u05de\u05e2\u05e7\u05d1 \u05de\u05d7\u05d9\u05e8\u05d9\u05dd", "free": False, "starter": False, "pro": True, "business": True},
            {"key": "competitor_job_alerts", "name": "\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05de\u05e9\u05e8\u05d5\u05ea \u05de\u05ea\u05d7\u05e8\u05d9\u05dd", "free": False, "starter": False, "pro": True, "business": True},
        ],
    },
    {
        "category": "AI \u05d5\u05d0\u05d5\u05d8\u05d5\u05de\u05e6\u05d9\u05d4",
        "features": [
            {"key": "ai_chat_messages_per_month", "name": "\u05d4\u05d5\u05d3\u05e2\u05d5\u05ea AI \u05dc\u05d7\u05d5\u05d3\u05e9", "free": "10", "starter": "100", "pro": "500", "business": "\u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4"},
            {"key": "ai_campaign_generator", "name": "\u05de\u05d7\u05d5\u05dc\u05dc \u05e7\u05de\u05e4\u05d9\u05d9\u05e0\u05d9\u05dd AI", "free": False, "starter": False, "pro": True, "business": True},
            {"key": "ai_response_generator", "name": "\u05de\u05d7\u05d5\u05dc\u05dc \u05ea\u05e9\u05d5\u05d1\u05d5\u05ea AI", "free": False, "starter": False, "pro": True, "business": True},
            {"key": "morning_briefing", "name": "\u05ea\u05d3\u05e8\u05d9\u05da \u05d9\u05d5\u05de\u05d9", "free": False, "starter": True, "pro": True, "business": True},
            {"key": "auto_review_response", "name": "\u05de\u05e2\u05e0\u05d4 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9 \u05dc\u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea", "free": False, "starter": False, "pro": True, "business": True},
            {"key": "whatsapp_alerts", "name": "\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea WhatsApp", "free": False, "starter": False, "pro": True, "business": True},
            {"key": "competitor_alerts_realtime", "name": "\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05de\u05ea\u05d7\u05e8\u05d9\u05dd \u05d1\u05d6\u05de\u05df \u05d0\u05de\u05ea", "free": False, "starter": False, "pro": True, "business": True},
        ],
    },
    {
        "category": "\u05d3\u05d5\u05d7\u05d5\u05ea",
        "features": [
            {"key": "weekly_report", "name": "\u05d3\u05d5\u05d7 \u05e9\u05d1\u05d5\u05e2\u05d9", "free": False, "starter": True, "pro": True, "business": True},
            {"key": "custom_reports", "name": "\u05d3\u05d5\u05d7\u05d5\u05ea \u05de\u05d5\u05ea\u05d0\u05de\u05d9\u05dd \u05d0\u05d9\u05e9\u05d9\u05ea", "free": False, "starter": False, "pro": True, "business": True},
            {"key": "intelligence_history_days", "name": "\u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d9\u05ea \u05de\u05d5\u05d3\u05d9\u05e2\u05d9\u05df", "free": "7 \u05d9\u05de\u05d9\u05dd", "starter": "30 \u05d9\u05de\u05d9\u05dd", "pro": "90 \u05d9\u05de\u05d9\u05dd", "business": "\u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4"},
        ],
    },
    {
        "category": "\u05ea\u05de\u05d9\u05db\u05d4",
        "features": [
            {"key": "cities", "name": "\u05e2\u05e8\u05d9\u05dd", "free": "1", "starter": "1", "pro": "3", "business": "\u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4"},
            {"key": "team_members", "name": "\u05d7\u05d1\u05e8\u05d9 \u05e6\u05d5\u05d5\u05ea", "free": "1", "starter": "1", "pro": "3", "business": "\u05dc\u05dc\u05d0 \u05d4\u05d2\u05d1\u05dc\u05d4"},
            {"key": "api_access", "name": "\u05d2\u05d9\u05e9\u05ea API", "free": False, "starter": False, "pro": False, "business": True},
            {"key": "dedicated_account_manager", "name": "\u05de\u05e0\u05d4\u05dc \u05dc\u05e7\u05d5\u05d7 \u05d9\u05d9\u05e2\u05d5\u05d3\u05d9", "free": False, "starter": False, "pro": False, "business": True},
        ],
    },
]


# ── Hebrew feature names for error messages ──

FEATURE_NAMES_HE = {
    "leads_scans_per_month": "\u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05dc\u05d9\u05d3\u05d9\u05dd",
    "leads_per_scan": "\u05dc\u05d9\u05d3\u05d9\u05dd \u05dc\u05e1\u05e8\u05d9\u05e7\u05d4",
    "leads_total_stored": "\u05dc\u05d9\u05d3\u05d9\u05dd \u05e9\u05de\u05d5\u05e8\u05d9\u05dd",
    "leads_export_csv": "\u05d9\u05d9\u05e6\u05d5\u05d0 CSV",
    "competitors_tracked": "\u05de\u05ea\u05d7\u05e8\u05d9\u05dd",
    "competitor_deep_analysis": "\u05e0\u05d9\u05ea\u05d5\u05d7 \u05de\u05ea\u05d7\u05e8\u05d9\u05dd \u05de\u05e2\u05de\u05d9\u05e7",
    "competitor_price_tracking": "\u05de\u05e2\u05e7\u05d1 \u05de\u05d7\u05d9\u05e8\u05d9\u05dd",
    "competitor_job_alerts": "\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05de\u05e9\u05e8\u05d5\u05ea",
    "intelligence_scan_per_month": "\u05e1\u05e8\u05d9\u05e7\u05d5\u05ea \u05de\u05d5\u05d3\u05d9\u05e2\u05d9\u05df",
    "intelligence_history_days": "\u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d9\u05ea \u05de\u05d5\u05d3\u05d9\u05e2\u05d9\u05df",
    "market_alerts": "\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05e9\u05d5\u05e7",
    "ai_chat_messages_per_month": "\u05d4\u05d5\u05d3\u05e2\u05d5\u05ea AI",
    "ai_advisor_templates": "\u05ea\u05d1\u05e0\u05d9\u05d5\u05ea \u05d9\u05d5\u05e2\u05e5",
    "ai_campaign_generator": "\u05de\u05d7\u05d5\u05dc\u05dc \u05e7\u05de\u05e4\u05d9\u05d9\u05e0\u05d9\u05dd",
    "ai_response_generator": "\u05de\u05d7\u05d5\u05dc\u05dc \u05ea\u05e9\u05d5\u05d1\u05d5\u05ea",
    "weekly_report": "\u05d3\u05d5\u05d7 \u05e9\u05d1\u05d5\u05e2\u05d9",
    "custom_reports": "\u05d3\u05d5\u05d7\u05d5\u05ea \u05de\u05d5\u05ea\u05d0\u05de\u05d9\u05dd \u05d0\u05d9\u05e9\u05d9\u05ea",
    "reports_history": "\u05d4\u05d9\u05e1\u05d8\u05d5\u05e8\u05d9\u05d9\u05ea \u05d3\u05d5\u05d7\u05d5\u05ea",
    "whatsapp_alerts": "\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea WhatsApp",
    "auto_review_response": "\u05de\u05e2\u05e0\u05d4 \u05d0\u05d5\u05d8\u05d5\u05de\u05d8\u05d9 \u05dc\u05d1\u05d9\u05e7\u05d5\u05e8\u05d5\u05ea",
    "morning_briefing": "\u05ea\u05d3\u05e8\u05d9\u05da \u05d9\u05d5\u05de\u05d9",
    "competitor_alerts_realtime": "\u05d4\u05ea\u05e8\u05d0\u05d5\u05ea \u05de\u05ea\u05d7\u05e8\u05d9\u05dd \u05d1\u05d6\u05de\u05df \u05d0\u05de\u05ea",
    "cities": "\u05e2\u05e8\u05d9\u05dd",
    "branches": "\u05e1\u05e0\u05d9\u05e4\u05d9\u05dd",
    "team_members": "\u05d7\u05d1\u05e8\u05d9 \u05e6\u05d5\u05d5\u05ea",
    "support_level": "\u05e8\u05de\u05ea \u05ea\u05de\u05d9\u05db\u05d4",
    "api_access": "\u05d2\u05d9\u05e9\u05ea API",
    "dedicated_account_manager": "\u05de\u05e0\u05d4\u05dc \u05dc\u05e7\u05d5\u05d7 \u05d9\u05d9\u05e2\u05d5\u05d3\u05d9",
}


def get_upgrade_plan(current_plan_id: str, feature: str) -> str | None:
    """Return the cheapest plan_id that unlocks a feature the user doesn't have."""
    current_idx = PLAN_ORDER.index(current_plan_id) if current_plan_id in PLAN_ORDER else 0

    for plan_id in PLAN_ORDER[current_idx + 1:]:
        plan = PLANS[plan_id]
        limit = plan["limits"].get(feature)
        if limit is None:
            continue
        # Boolean feature — must be True
        if isinstance(limit, bool) and limit:
            return plan_id
        # Numeric — must be > 0 or -1 (unlimited)
        if isinstance(limit, int) and (limit == -1 or limit > 0):
            return plan_id
    return None
