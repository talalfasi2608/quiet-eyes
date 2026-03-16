"""
Seed data for the Playbook Library — system-level playbooks and template assets.
Run once via `seed_playbook_library(db)` or an admin endpoint.
"""

from sqlalchemy.orm import Session

from app.models import Playbook, TemplateAsset


SYSTEM_PLAYBOOKS = [
    {
        "name": "Lead Surge Response",
        "description": "Automatically creates an audience and campaign draft when a spike in high-intent leads is detected.",
        "category": "lead_management",
        "vertical": "local_services",
        "tags": ["leads", "automation", "campaign"],
        "trigger_conditions": {
            "type": "lead_spike",
            "min_leads": 5,
            "window_hours": 24,
            "min_score": 60,
        },
        "suggested_actions": ["AUDIENCE_DRAFT", "CAMPAIGN_DRAFT"],
        "approval_policy": "REVIEW",
        "campaign_template": {
            "objective": "LEADS",
            "platform": "meta",
            "daily_budget": 30,
            "tone": "urgent",
        },
        "audience_template": {
            "intents": ["PURCHASE", "COMPARISON"],
            "min_score": 50,
        },
    },
    {
        "name": "Negative Review Shield",
        "description": "Detects negative review spikes and drafts a reputation response campaign with a review-reply template.",
        "category": "reputation",
        "vertical": "restaurants",
        "tags": ["reputation", "reviews", "crisis"],
        "trigger_conditions": {
            "type": "review_sentiment_spike",
            "sentiment": "NEG",
            "min_count": 3,
            "window_hours": 48,
        },
        "suggested_actions": ["REPLY_DRAFT", "CAMPAIGN_DRAFT"],
        "approval_policy": "REVIEW",
        "campaign_template": {
            "objective": "TRAFFIC",
            "platform": "meta",
            "daily_budget": 20,
            "tone": "empathetic",
        },
    },
    {
        "name": "Competitor Price Alert",
        "description": "Triggers when a competitor changes their offer. Creates a counter-campaign draft with adjusted pricing messaging.",
        "category": "competitive_response",
        "vertical": "real_estate",
        "tags": ["competitors", "pricing", "campaign"],
        "trigger_conditions": {
            "type": "competitor_event",
            "event_type": "OFFER_CHANGE",
        },
        "suggested_actions": ["CAMPAIGN_DRAFT"],
        "approval_policy": "REVIEW",
        "campaign_template": {
            "objective": "LEADS",
            "platform": "meta",
            "daily_budget": 40,
            "tone": "competitive",
        },
    },
    {
        "name": "Trend Rider",
        "description": "Detects trending topics relevant to your business and creates a timely campaign to capitalize on the buzz.",
        "category": "trend_marketing",
        "vertical": "beauty_clinics",
        "tags": ["trends", "viral", "campaign", "audience"],
        "trigger_conditions": {
            "type": "trend_spike",
            "min_spike_score": 70,
        },
        "suggested_actions": ["AUDIENCE_DRAFT", "CAMPAIGN_DRAFT"],
        "approval_policy": "REVIEW",
        "campaign_template": {
            "objective": "TRAFFIC",
            "platform": "meta",
            "daily_budget": 25,
            "tone": "trendy",
        },
        "audience_template": {
            "intents": ["PURCHASE", "QUESTION"],
            "min_score": 30,
        },
    },
    {
        "name": "CRM Lead Nurture",
        "description": "Syncs high-score leads to CRM and creates a follow-up campaign for leads that haven't converted in 7 days.",
        "category": "lead_management",
        "vertical": "local_services",
        "tags": ["crm", "leads", "nurture", "followup"],
        "trigger_conditions": {
            "type": "lead_age",
            "min_days": 7,
            "status": "SAVED",
            "min_score": 50,
        },
        "suggested_actions": ["CRM_SYNC", "CAMPAIGN_DRAFT"],
        "approval_policy": "AUTO",
        "campaign_template": {
            "objective": "LEADS",
            "platform": "meta",
            "daily_budget": 15,
            "tone": "nurturing",
        },
    },
    {
        "name": "Weekend Promo Blitz",
        "description": "Launches a weekend promotion campaign targeting high-intent leads every Friday. Ideal for restaurants and retail.",
        "category": "scheduled_campaign",
        "vertical": "restaurants",
        "tags": ["scheduled", "promo", "weekend", "campaign"],
        "trigger_conditions": {
            "type": "schedule",
            "day_of_week": "friday",
            "time": "10:00",
        },
        "suggested_actions": ["CAMPAIGN_DRAFT"],
        "approval_policy": "REVIEW",
        "campaign_template": {
            "objective": "SALES",
            "platform": "meta",
            "daily_budget": 50,
            "tone": "promotional",
        },
    },
]


SYSTEM_TEMPLATE_ASSETS = [
    {
        "type": "campaign_copy",
        "name": "Lead Magnet — Local Services",
        "description": "High-converting ad copy for local service businesses targeting purchase-intent leads.",
        "vertical": "local_services",
        "content": {
            "headline": "{{business_name}} — Trusted by Your Neighbors",
            "primary_text": "Looking for reliable {{category}}? Join hundreds of satisfied customers. Book your free consultation today.",
            "cta": "BOOK_NOW",
            "variants": [
                {"headline": "Expert {{category}} Near You", "cta": "LEARN_MORE"},
                {"headline": "Top-Rated {{category}} in {{location}}", "cta": "GET_QUOTE"},
            ],
        },
        "tags": ["local", "services", "lead_magnet"],
    },
    {
        "type": "campaign_copy",
        "name": "Beauty Promo — Seasonal",
        "description": "Seasonal promotion copy for beauty clinics with urgency-driven messaging.",
        "vertical": "beauty_clinics",
        "content": {
            "headline": "This Season's Best {{category}} Deals",
            "primary_text": "Limited time offer! Book your {{category}} treatment this week and save 20%. Our experts are ready to help you look your best.",
            "cta": "BOOK_NOW",
            "variants": [
                {"headline": "Transform Your Look — Special Offer", "cta": "SHOP_NOW"},
            ],
        },
        "tags": ["beauty", "seasonal", "promo"],
    },
    {
        "type": "audience_def",
        "name": "High-Intent Purchase Audience",
        "description": "Audience definition targeting leads with PURCHASE intent and score >= 60.",
        "vertical": None,
        "content": {
            "intents": ["PURCHASE"],
            "min_score": 60,
            "min_confidence": 50,
            "recency_days": 30,
        },
        "tags": ["audience", "high_intent", "purchase"],
    },
    {
        "type": "audience_def",
        "name": "Comparison Shoppers",
        "description": "Audience of leads comparing options — ideal for competitive positioning campaigns.",
        "vertical": None,
        "content": {
            "intents": ["COMPARISON"],
            "min_score": 40,
            "min_confidence": 40,
            "recency_days": 14,
        },
        "tags": ["audience", "comparison", "competitive"],
    },
    {
        "type": "reputation_response",
        "name": "Negative Review Reply — Empathetic",
        "description": "Template for responding to negative reviews with empathy and a resolution offer.",
        "vertical": None,
        "content": {
            "template": "Hi {{reviewer_name}}, thank you for sharing your experience. We're sorry to hear about {{issue_summary}}. We take this seriously and would love to make it right. Please reach out to us at {{contact_info}} so we can address this personally.",
            "tone": "empathetic",
            "follow_up_action": "CRM_SYNC",
        },
        "tags": ["reputation", "negative", "empathetic"],
    },
    {
        "type": "trend_reaction",
        "name": "Trend Capitalizer — Quick Campaign",
        "description": "Template for quickly spinning up a campaign around a trending topic.",
        "vertical": None,
        "content": {
            "headline": "{{trend_topic}} — {{business_name}} Has You Covered",
            "primary_text": "Everyone's talking about {{trend_topic}}. See how {{business_name}} can help you {{value_proposition}}.",
            "cta": "LEARN_MORE",
            "urgency": "high",
        },
        "tags": ["trend", "viral", "quick_launch"],
    },
    {
        "type": "crm_followup",
        "name": "7-Day Lead Follow-Up",
        "description": "CRM sync template for leads that haven't converted after 7 days.",
        "vertical": None,
        "content": {
            "delay_days": 7,
            "message_template": "Hi {{lead_name}}, we noticed you were interested in {{category}}. We'd love to help — reply to this message or book a time that works for you.",
            "sync_fields": ["name", "email", "intent", "score"],
        },
        "tags": ["crm", "followup", "nurture"],
    },
]


def seed_playbook_library(db: Session) -> dict[str, int]:
    """Seed system playbooks and template assets. Skips if already seeded."""
    playbooks_created = 0
    assets_created = 0

    # Check if already seeded
    existing = db.query(Playbook).filter(Playbook.creator_type == "system").count()
    if existing > 0:
        return {"playbooks_created": 0, "assets_created": 0}

    for pb_data in SYSTEM_PLAYBOOKS:
        pb = Playbook(
            business_id=None,
            creator_type="system",
            visibility="public",
            version=1,
            install_count=0,
            **pb_data,
        )
        db.add(pb)
        playbooks_created += 1

    for asset_data in SYSTEM_TEMPLATE_ASSETS:
        asset = TemplateAsset(
            creator_type="system",
            visibility="public",
            **asset_data,
        )
        db.add(asset)
        assets_created += 1

    db.commit()
    return {"playbooks_created": playbooks_created, "assets_created": assets_created}
