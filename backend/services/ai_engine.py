"""
AI Engine for Quiet Eyes.

Uses Anthropic Claude (via claude_client wrapper) to analyze business data,
classify archetypes, and generate actionable insight cards in Hebrew.
"""

import json
import uuid
import logging
from typing import Optional

import anthropic
from services import claude_client

from models import (
    ActionCard,
    BusinessProfile,
    WeeklyStat,
    Archetype,
    CardType,
)

# Configure logging
logger = logging.getLogger(__name__)


# =============================================================================
# ARCHETYPE CLASSIFICATION
# =============================================================================

ARCHETYPE_PROMPT = """You are a business analyst specializing in Israeli SMBs.
Analyze the following business description and classify it into ONE archetype.

ARCHETYPES:
1. Visual - Businesses that sell through images (restaurants, fashion, design, beauty salons, barbers)
2. Expert - Professional services (lawyers, doctors, accountants, consultants)
3. Field - Businesses with service areas (deliveries, repairs, cleaning, contractors)
4. Merchant - Retail and sales (shops, e-commerce, stores)

Also extract:
- Business type in Hebrew (e.g., "פיצרייה", "מספרה", "משרד עורכי דין")
- Appropriate emoji
- 4 relevant trending hashtags in Hebrew

BUSINESS DESCRIPTION: {description}

Respond ONLY with valid JSON in this exact format:
{{
    "archetype": "Visual|Expert|Field|Merchant",
    "name_hebrew": "שם העסק בעברית",
    "emoji": "🍕",
    "trending_topics": ["#האשטג1", "#האשטג2", "#האשטג3", "#האשטג4"]
}}"""


async def classify_business(
    description: str
) -> dict:
    """
    Classify a business into an archetype using Claude.

    Args:
        description: Business description text

    Returns:
        Dictionary with archetype, name_hebrew, emoji, trending_topics

    Raises:
        anthropic.APIError: If API call fails
        ValueError: If response parsing fails
    """
    try:
        content = claude_client.chat(
            messages=[
                {
                    "role": "user",
                    "content": ARCHETYPE_PROMPT.format(description=description)
                }
            ],
            system="You are a business classification expert. Always respond with valid JSON only.",
            temperature=0.3,  # Lower temperature for consistent classification
            max_tokens=200,
        )

        result = json.loads(content)
        logger.info(f"Classified business as: {result.get('archetype')}")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse classification response: {e}")
        raise ValueError(f"Invalid JSON response from AI: {e}")
    except anthropic.APIError as e:
        logger.error(f"Claude API error during classification: {e}")
        raise


# =============================================================================
# INSIGHT GENERATION
# =============================================================================

INSIGHTS_PROMPT = """You are a business intelligence analyst for Israeli SMBs.
Generate 3 actionable insight cards for a {archetype} business ({business_type}).

Each card should be either:
- ALERT: Something requiring attention (competitor action, negative trend, urgent issue)
- OPPORTUNITY: A chance to grow (market trend, timing opportunity, improvement suggestion)

The insights should be:
1. Specific and actionable
2. Written in Hebrew
3. Relevant to the {archetype} archetype
4. Include realistic scenarios
{knowledge_context}
Respond with ONLY valid JSON array:
[
    {{
        "type": "alert|opportunity",
        "title": "כותרת קצרה בעברית",
        "description": "תיאור מפורט עם הקשר והמלצה",
        "action_button_text": "טקסט לכפתור",
        "priority": 1-5
    }}
]"""


def _build_knowledge_context(business_id: str = None) -> str:
    """
    Fetch knowledge base data for a business and format it as context
    for AI system prompts. Returns empty string if no knowledge found.
    """
    if not business_id:
        return ""

    try:
        from config import supabase
        if not supabase:
            return ""

        # Get user_id from business -> workspace -> owner chain
        biz = (
            supabase.table("businesses")
            .select("workspace_id")
            .eq("id", business_id)
            .maybe_single()
            .execute()
        )
        if not biz.data:
            return ""

        workspace_id = biz.data.get("workspace_id")
        if not workspace_id:
            return ""

        ws = (
            supabase.table("workspaces")
            .select("owner_id")
            .eq("id", workspace_id)
            .maybe_single()
            .execute()
        )
        if not ws.data:
            return ""

        user_id = ws.data.get("owner_id")
        if not user_id:
            return ""

        # Fetch knowledge base
        kb = (
            supabase.table("knowledge_base")
            .select("knowledge")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if not kb.data or not kb.data.get("knowledge"):
            return ""

        k = kb.data["knowledge"]
        parts = []
        if k.get("uniqueStyle"):
            parts.append(f"- Unique Style: {k['uniqueStyle']}")
        if k.get("secretSauce"):
            parts.append(f"- Secret Weapon: {k['secretSauce']}")
        if k.get("targetNiche"):
            parts.append(f"- Target Niche: {k['targetNiche']}")
        if k.get("competitiveEdge"):
            parts.append(f"- Competitive Edge: {k['competitiveEdge']}")

        if not parts:
            return ""

        return (
            "\n\nBUSINESS KNOWLEDGE (use this to personalize your advice):\n"
            + "\n".join(parts) + "\n"
        )
    except Exception:
        return ""


async def generate_insights(
    archetype: str,
    business_type: str,
    count: int = 3,
    business_id: str = None,
) -> list[ActionCard]:
    """
    Generate actionable insight cards for a business.

    Args:
        archetype: Business archetype (Visual/Expert/Field/Merchant)
        business_type: Specific business type in Hebrew
        count: Number of cards to generate
        business_id: Optional business ID for knowledge context injection

    Returns:
        List of ActionCard objects

    Raises:
        anthropic.APIError: If API call fails
    """
    knowledge_context = _build_knowledge_context(business_id)

    try:
        content = claude_client.chat(
            messages=[
                {
                    "role": "user",
                    "content": INSIGHTS_PROMPT.format(
                        archetype=archetype,
                        business_type=business_type,
                        knowledge_context=knowledge_context,
                    )
                }
            ],
            system="You are an Israeli business intelligence expert. Generate realistic, actionable insights in Hebrew. Always respond with valid JSON only.",
            temperature=0.7,  # Higher temperature for creative insights
            max_tokens=800,
        )

        # Parse the response - extract the array
        logger.info(f"Raw insights response: {content[:200]}...")
        parsed = json.loads(content)

        # Handle various key names the model might use
        cards_data = []
        if isinstance(parsed, list):
            cards_data = parsed
        elif isinstance(parsed, dict):
            # Try common key names
            for key in ["cards", "insights", "data", "items", "results"]:
                if key in parsed and isinstance(parsed[key], list):
                    cards_data = parsed[key]
                    break
            # If still empty, try the first list value found
            if not cards_data:
                for value in parsed.values():
                    if isinstance(value, list):
                        cards_data = value
                        break

        cards = []
        for i, card_data in enumerate(cards_data[:count]):
            try:
                card = ActionCard(
                    id=f"card_{uuid.uuid4().hex[:8]}",
                    type=CardType(card_data.get("type", "opportunity")),
                    title=(card_data.get("title", "") or "")[:100],
                    description=(card_data.get("description", "") or "")[:500],
                    action_button_text=(card_data.get("action_button_text", "צפה") or "צפה")[:50],
                    priority=min(5, max(1, int(card_data.get("priority", 3)))),
                    source="ai_generated"
                )
                cards.append(card)
            except Exception as e:
                logger.warning(f"Skipping invalid card data: {e}")

        logger.info(f"Generated {len(cards)} insight cards")
        return cards

    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse insights response: {e}")
        # Return fallback cards
        return _generate_fallback_cards(archetype)
    except anthropic.APIError as e:
        logger.error(f"Claude API error during insight generation: {e}")
        raise


# =============================================================================
# COMPETITOR ANALYSIS
# =============================================================================

COMPETITOR_CARD_PROMPT = """You are a competitive intelligence analyst for Israeli businesses.

A competitor scan found the following information:
COMPETITOR: {competitor_name} ({competitor_type})
FINDING: {finding}

Generate a single ALERT card in Hebrew that:
1. Summarizes the competitive threat or opportunity
2. Provides actionable advice
3. Creates urgency appropriately

Respond with ONLY valid JSON:
{{
    "type": "alert",
    "title": "כותרת קצרה ומשפיעה",
    "description": "תיאור מפורט עם הקשר, השפעה פוטנציאלית, והמלצה לפעולה",
    "action_button_text": "טקסט לכפתור פעולה",
    "priority": 1-5
}}"""


async def generate_competitor_card(
    competitor_name: str,
    competitor_type: str,
    finding: str
) -> ActionCard:
    """
    Generate an alert card based on competitor scan results.

    Args:
        competitor_name: Name of the competitor
        competitor_type: Type of competitor business
        finding: What was found during the scan

    Returns:
        ActionCard with competitor alert

    Raises:
        anthropic.APIError: If API call fails
    """
    try:
        content = claude_client.chat(
            messages=[
                {
                    "role": "user",
                    "content": COMPETITOR_CARD_PROMPT.format(
                        competitor_name=competitor_name,
                        competitor_type=competitor_type,
                        finding=finding
                    )
                }
            ],
            system="You are a competitive intelligence expert. Generate actionable alerts in Hebrew. Always respond with valid JSON only.",
            temperature=0.5,
            max_tokens=300,
        )

        card_data = json.loads(content)

        card = ActionCard(
            id=f"comp_{uuid.uuid4().hex[:8]}",
            type=CardType.ALERT,
            title=(card_data.get("title", "התראת מתחרה") or "התראת מתחרה")[:100],
            description=(card_data.get("description", "") or "")[:500],
            action_button_text=(card_data.get("action_button_text", "צפה בפרטים") or "צפה בפרטים")[:50],
            priority=min(5, max(1, int(card_data.get("priority", 4)))),
            source=f"competitor_scan:{competitor_name}"
        )

        logger.info(f"Generated competitor card for: {competitor_name}")
        return card

    except (json.JSONDecodeError, anthropic.APIError, ValueError, Exception) as e:
        logger.error(f"Error generating competitor card: {e}")
        # Return fallback card
        return ActionCard(
            id=f"comp_{uuid.uuid4().hex[:8]}",
            type=CardType.ALERT,
            title=f"התראה: {competitor_name}",
            description=f"זוהתה פעילות מצד {competitor_name}. מומלץ לבדוק ולהגיב בהתאם.",
            action_button_text="בדוק עכשיו",
            priority=3,
            source=f"competitor_scan:{competitor_name}"
        )


# =============================================================================
# FULL BUSINESS ANALYSIS
# =============================================================================

async def analyze_business_full(
    description: str
) -> tuple[BusinessProfile, list[ActionCard]]:
    """
    Perform complete business analysis: classification + insight generation.

    Args:
        description: Business description text

    Returns:
        Tuple of (BusinessProfile, list of ActionCards)
    """
    # Step 1: Classify the business
    classification = await classify_business(description)

    archetype_str = classification.get("archetype", "Merchant")
    name_hebrew = classification.get("name_hebrew", "עסק")
    emoji = classification.get("emoji", "💼")
    trending = classification.get("trending_topics", [])

    # Map string to enum
    archetype = Archetype(archetype_str)

    # Step 2: Generate initial insights
    cards = await generate_insights(archetype_str, name_hebrew)

    # Step 3: Create the business profile
    profile = BusinessProfile(
        id=f"biz_{uuid.uuid4().hex[:8]}",
        name=_get_english_name(archetype),
        name_hebrew=name_hebrew,
        archetype=archetype,
        description=description,
        pulse_score=_generate_initial_pulse_score(),
        pulse_change="+0.0",  # New business, no change yet
        emoji=emoji,
        trending_topics=trending,
        weekly_stats=_generate_initial_stats(archetype)
    )

    return profile, cards


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _get_english_name(archetype: Archetype) -> str:
    """Get English business type name based on archetype."""
    names = {
        Archetype.VISUAL: "Visual Business",
        Archetype.EXPERT: "Professional Services",
        Archetype.FIELD: "Field Services",
        Archetype.MERCHANT: "Retail Business"
    }
    return names.get(archetype, "Business")


def _generate_initial_pulse_score() -> float:
    """Generate a realistic initial pulse score for new businesses."""
    import random
    # New businesses typically start with a moderate score
    return round(random.uniform(6.0, 8.0), 1)


def _generate_initial_stats(archetype: Archetype) -> list[WeeklyStat]:
    """Generate initial weekly stats based on archetype."""
    stats_map = {
        Archetype.VISUAL: [
            WeeklyStat(label="צפיות", value="0"),
            WeeklyStat(label="תורים", value="0"),
            WeeklyStat(label="לקוחות חדשים", value="0")
        ],
        Archetype.EXPERT: [
            WeeklyStat(label="פניות", value="0"),
            WeeklyStat(label="פגישות", value="0"),
            WeeklyStat(label="תיקים פעילים", value="0")
        ],
        Archetype.FIELD: [
            WeeklyStat(label="הזמנות", value="0"),
            WeeklyStat(label="ביקורים", value="0"),
            WeeklyStat(label="אזורים פעילים", value="0")
        ],
        Archetype.MERCHANT: [
            WeeklyStat(label="הזמנות", value="0"),
            WeeklyStat(label="מכירות", value="0"),
            WeeklyStat(label="לקוחות חדשים", value="0")
        ]
    }
    return stats_map.get(archetype, [])


def _generate_fallback_cards(archetype: str) -> list[ActionCard]:
    """Generate fallback cards when AI fails."""
    return [
        ActionCard(
            id=f"fallback_{uuid.uuid4().hex[:8]}",
            type=CardType.OPPORTUNITY,
            title="ברוכים הבאים!",
            description="המערכת שלנו מנתחת את השוק שלך. בקרוב תקבל תובנות מותאמות אישית.",
            action_button_text="למד עוד",
            priority=2,
            source="system"
        )
    ]
