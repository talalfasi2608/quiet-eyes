"""
Audience Router — current opportunities / hot audiences.
"""

import json
import logging
import os
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Query, Depends, Request

from routers._auth_helper import require_auth, get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/audience", tags=["Audience"])


def _get_service_client():
    """Get service-role client to bypass RLS."""
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None

# In-memory cache: { business_id: { "opportunities": [...], "generated_at": datetime } }
_opportunity_cache: dict = {}
_CACHE_TTL_HOURS = 24


@router.get("/current-opportunities/{business_id}")
async def current_opportunities(business_id: str, request: Request, limit: int = Query(default=5), auth_user_id: str = Depends(require_auth)):
    try:
        # Check cache first
        cached = _opportunity_cache.get(business_id)
        if cached:
            age = datetime.now(timezone.utc) - cached["generated_at"]
            if age < timedelta(hours=_CACHE_TTL_HOURS):
                return {"opportunities": cached["opportunities"][:limit]}

        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"opportunities": []}

        # Look up business info
        biz_result = (
            sb.table("businesses")
            .select("id, business_name, industry, location")
            .eq("id", business_id)
            .execute()
        )

        if not biz_result.data:
            return {"opportunities": []}

        business = biz_result.data[0]

        # Look up competitors for this business
        comp_result = (
            sb.table("competitors")
            .select("name, industry, location, google_rating, website")
            .eq("business_id", business_id)
            .execute()
        )

        competitors = comp_result.data or []

        # Generate opportunities via Claude
        opportunities = await _generate_opportunities(business, competitors, limit)

        # Cache the results
        _opportunity_cache[business_id] = {
            "opportunities": opportunities,
            "generated_at": datetime.now(timezone.utc),
        }

        return {"opportunities": opportunities[:limit]}

    except Exception as e:
        logger.error(f"current_opportunities error: {e}")
        return {"opportunities": []}


async def _generate_opportunities(business: dict, competitors: list, limit: int) -> list:
    """Use Claude to generate audience opportunities based on business + competitor data."""
    try:
        from config import get_settings
        settings = get_settings()

        if not settings.anthropic_api_key:
            logger.debug("Anthropic API key not configured, returning empty opportunities")
            return []

        from services.claude_client import chat as claude_chat

        biz_name = business.get("business_name", "Unknown")
        biz_industry = business.get("industry", "General")
        biz_location = business.get("location", "")

        comp_summary = ""
        if competitors:
            comp_lines = []
            for c in competitors[:5]:
                line = f"- {c.get('name', 'Unknown')}"
                if c.get("google_rating"):
                    line += f" (rating: {c['google_rating']})"
                if c.get("website"):
                    line += f" ({c['website']})"
                comp_lines.append(line)
            comp_summary = "\n".join(comp_lines)

        prompt = f"""You are an audience intelligence analyst for Israeli SMBs.

Business: {biz_name}
Industry: {biz_industry}
Location: {biz_location}

Competitors:
{comp_summary if comp_summary else "No competitors tracked yet."}

Generate exactly {limit} audience opportunity ideas for this business.
Each opportunity should identify a specific audience segment this business could target.

Respond with ONLY valid JSON in this exact format:
{{
    "opportunities": [
        {{
            "title": "Short title in Hebrew",
            "description": "Detailed description in Hebrew (2-3 sentences)",
            "audience_size": "estimated audience size as string e.g. '5,000-10,000'",
            "relevance": 0.0 to 1.0,
            "platform": "google|facebook|instagram|tiktok|linkedin",
            "action": "Short actionable CTA in Hebrew"
        }}
    ]
}}"""

        system_prompt = (
            "You are an Israeli digital marketing expert. "
            "Generate realistic, actionable audience insights in Hebrew. "
            "Always respond with valid JSON only."
        )

        raw_response = claude_chat(
            messages=[{"role": "user", "content": prompt}],
            system=system_prompt,
            temperature=0.7,
            max_tokens=1000,
        )

        parsed = json.loads(raw_response)

        raw_opportunities = []
        if isinstance(parsed, dict):
            raw_opportunities = parsed.get("opportunities", [])
        elif isinstance(parsed, list):
            raw_opportunities = parsed

        # Normalize into expected shape
        opportunities = []
        for i, opp in enumerate(raw_opportunities):
            opportunities.append({
                "id": f"opp_{uuid.uuid4().hex[:8]}",
                "title": opp.get("title", ""),
                "description": opp.get("description", ""),
                "audience_size": opp.get("audience_size", "N/A"),
                "relevance": opp.get("relevance", 0.5),
                "platform": opp.get("platform", "google"),
                "action": opp.get("action", ""),
            })

        return opportunities

    except Exception as e:
        logger.error(f"_generate_opportunities AI error: {e}")
        return []
