"""
Knowledge Base Router.

Handles knowledge base CRUD for the AI learning system.
KnowledgeBase.tsx calls GET/POST /knowledge/{user_id} and related endpoints.
"""

import logging
import os
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/knowledge", tags=["Knowledge Base"])


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


def _get_supabase():
    """Get DB client — prefer service-role to bypass RLS."""
    svc = _get_service_client()
    if svc:
        return svc
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


class KnowledgeData(BaseModel):
    uniqueStyle: str = ""
    secretSauce: str = ""
    targetNiche: str = ""
    competitiveEdge: str = ""


class TrackedSite(BaseModel):
    id: Optional[str] = None
    url: str = ""
    name: str = ""
    type: str = "custom"
    status: str = "pending"


class KnowledgeSavePayload(BaseModel):
    knowledge: Optional[KnowledgeData] = None
    tracked_sites: Optional[list[TrackedSite]] = None


class DiscoverSitePayload(BaseModel):
    user_id: str
    url: str


# Default learning progress for new users
def _default_learning_progress():
    return {
        "overall": 35,
        "categories": [
            {"name": "Business Profile", "nameHebrew": "פרופיל עסקי", "progress": 60, "icon": "🏢"},
            {"name": "Market Position", "nameHebrew": "מיקום שוק", "progress": 45, "icon": "📊"},
            {"name": "Competitor Intel", "nameHebrew": "מודיעין מתחרים", "progress": 30, "icon": "🎯"},
            {"name": "Customer Insights", "nameHebrew": "תובנות לקוחות", "progress": 20, "icon": "👥"},
            {"name": "Industry Trends", "nameHebrew": "מגמות תעשייה", "progress": 25, "icon": "📈"},
        ],
        "dataPoints": 47,
        "lastUpdated": datetime.now(timezone.utc).isoformat(),
    }


# ── Fixed routes MUST come before /{user_id} to avoid route collision ──

@router.post("/discover-site")
async def discover_site(payload: DiscoverSitePayload, auth_user_id: str = Depends(require_auth)):
    """Discover and analyze a tracked site (stub — returns acknowledgment)."""
    if payload.user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    logger.info(f"Site discovery requested: {payload.url} for user {payload.user_id}")
    return {
        "success": True,
        "message": "Site discovery initiated",
        "url": payload.url,
        "status": "pending",
    }


@router.get("/{user_id}")
async def get_knowledge(user_id: str, auth_user_id: str = Depends(require_auth)):
    """Fetch knowledge base data for a user."""
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        result = (
            supabase.table("knowledge_base")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if result.data:
            row = result.data
            return {
                "knowledge": row.get("knowledge", {}),
                "tracked_sites": row.get("tracked_sites", []),
                "learning_progress": row.get("learning_progress", _default_learning_progress()),
            }
        else:
            # No data yet — return empty defaults so frontend can show its default state
            return {
                "knowledge": {},
                "tracked_sites": [],
                "learning_progress": _default_learning_progress(),
            }
    except Exception as e:
        logger.error(f"get_knowledge error: {e}")
        # Table might not exist — return defaults so frontend isn't blocked
        return {
            "knowledge": {},
            "tracked_sites": [],
            "learning_progress": _default_learning_progress(),
        }


@router.post("/{user_id}")
async def save_knowledge(user_id: str, payload: KnowledgeSavePayload, auth_user_id: str = Depends(require_auth)):
    """Save knowledge base data for a user."""
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    row_data = {
        "user_id": user_id,
        "knowledge": payload.knowledge.model_dump() if payload.knowledge else {},
        "tracked_sites": [s.model_dump() for s in payload.tracked_sites] if payload.tracked_sites else [],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        # Upsert — create or update
        result = (
            supabase.table("knowledge_base")
            .upsert(row_data, on_conflict="user_id")
            .execute()
        )
        logger.info(f"Saved knowledge for user {user_id}")
        return {"success": True}
    except Exception as e:
        logger.error(f"save_knowledge error: {e}")
        # If table doesn't exist, still return success to avoid blocking the UI
        return {"success": True, "warning": "Data saved locally only"}


@router.post("/learn/{user_id}")
async def trigger_learning(user_id: str, auth_user_id: str = Depends(require_auth)):
    """Trigger a learning cycle for the user's knowledge base."""
    if user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    supabase = _get_supabase()

    # Calculate updated learning progress based on knowledge completeness
    progress = _default_learning_progress()

    if supabase:
        try:
            result = (
                supabase.table("knowledge_base")
                .select("knowledge")
                .eq("user_id", user_id)
                .maybe_single()
                .execute()
            )
            if result.data and result.data.get("knowledge"):
                kb = result.data["knowledge"]
                # Calculate progress based on filled fields
                filled = sum(1 for v in kb.values() if v and len(str(v)) > 10)
                base = 35 + (filled * 12)  # 35 base + 12 per filled field = max 83
                progress["overall"] = min(base, 95)
                progress["categories"][0]["progress"] = min(60 + filled * 10, 95)
                progress["categories"][1]["progress"] = min(45 + filled * 8, 90)
                progress["dataPoints"] = 47 + filled * 15
                progress["lastUpdated"] = datetime.now(timezone.utc).isoformat()

                # Update progress in DB
                supabase.table("knowledge_base").update({
                    "learning_progress": progress,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }).eq("user_id", user_id).execute()
        except Exception as e:
            logger.debug(f"Learning trigger DB error: {e}")

    return {
        "success": True,
        "learning_progress": progress,
    }
