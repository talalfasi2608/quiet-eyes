"""
Beta Feedback Router

Handles feedback collection, NPS surveys, and feedback analytics
for the beta launch.
"""

import os
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel

from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/feedback", tags=["Beta Feedback"])


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def _is_super_admin(user_id: str) -> bool:
    super_uid = os.getenv("SUPER_ADMIN_UID", "")
    return bool(super_uid) and user_id == super_uid


def _require_super_admin(user_id: str):
    if not _is_super_admin(user_id):
        raise HTTPException(status_code=403, detail="Super-admin access required")


def _get_service_client():
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class FeedbackSubmitRequest(BaseModel):
    type: str  # nps, feature_request, bug, general
    score: Optional[int] = None  # 0-10 for NPS
    message: Optional[str] = None
    trigger: Optional[str] = "manual"  # day_7, day_14, day_30, manual


# ═══════════════════════════════════════════════════════════════════════════════
# AUTHENTICATED ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/submit")
async def submit_feedback(
    body: FeedbackSubmitRequest,
    auth_user_id: str = Depends(require_auth),
):
    """Submit feedback (auth required)."""
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Validate type
    valid_types = ("nps", "feature_request", "bug", "general")
    if body.type not in valid_types:
        raise HTTPException(status_code=400, detail=f"type must be one of: {', '.join(valid_types)}")

    # Validate score for NPS
    if body.type == "nps" and body.score is None:
        raise HTTPException(status_code=400, detail="NPS feedback requires a score (0-10)")
    if body.score is not None and (body.score < 0 or body.score > 10):
        raise HTTPException(status_code=400, detail="Score must be between 0 and 10")

    # Validate trigger
    valid_triggers = ("day_7", "day_14", "day_30", "manual")
    trigger = body.trigger or "manual"
    if trigger not in valid_triggers:
        trigger = "manual"

    insert_data = {
        "user_id": auth_user_id,
        "type": body.type,
        "score": body.score,
        "message": body.message,
        "trigger": trigger,
    }

    result = supabase.table("beta_feedback").insert(insert_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to submit feedback")

    logger.info(f"[Feedback] {body.type} from {auth_user_id[:8]}... (score={body.score})")

    return {"success": True, "id": result.data[0]["id"]}


@router.get("/my")
async def get_my_feedback(
    auth_user_id: str = Depends(require_auth),
):
    """Get the authenticated user's own feedback entries."""
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    result = (
        supabase.table("beta_feedback")
        .select("*")
        .eq("user_id", auth_user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {"success": True, "feedback": result.data or []}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/all")
async def get_all_feedback(
    auth_user_id: str = Depends(require_auth),
    type: Optional[str] = Query(default=None),
    trigger: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Admin only — get all feedback with optional filters."""
    _require_super_admin(auth_user_id)
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    q = (
        supabase.table("beta_feedback")
        .select("*", count="exact")
        .order("created_at", desc=True)
    )

    if type:
        q = q.eq("type", type)
    if trigger:
        q = q.eq("trigger", trigger)

    result = q.range(offset, offset + limit - 1).execute()

    return {
        "success": True,
        "feedback": result.data or [],
        "total": result.count or 0,
    }


@router.get("/nps-summary")
async def get_nps_summary(
    auth_user_id: str = Depends(require_auth),
):
    """Admin only — get NPS score breakdown."""
    _require_super_admin(auth_user_id)
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Get all NPS feedback
    result = (
        supabase.table("beta_feedback")
        .select("score, user_id")
        .eq("type", "nps")
        .not_.is_("score", "null")
        .execute()
    )
    nps_entries = result.data or []

    if not nps_entries:
        return {
            "success": True,
            "total_responses": 0,
            "promoters": 0,
            "passives": 0,
            "detractors": 0,
            "nps_score": 0,
            "average_score": 0,
        }

    scores = [e["score"] for e in nps_entries]
    promoters = sum(1 for s in scores if s >= 9)
    passives = sum(1 for s in scores if 7 <= s <= 8)
    detractors = sum(1 for s in scores if s <= 6)
    total = len(scores)

    nps_score = round(((promoters - detractors) / total) * 100) if total > 0 else 0
    avg_score = round(sum(scores) / total, 1) if total > 0 else 0

    # Unique respondents
    unique_users = len(set(e["user_id"] for e in nps_entries))

    # Get total beta users for response rate
    beta_users = (
        supabase.table("beta_waitlist")
        .select("id", count="exact")
        .eq("status", "activated")
        .execute()
    )
    total_beta = beta_users.count or 0
    response_rate = round((unique_users / total_beta * 100), 1) if total_beta > 0 else 0

    return {
        "success": True,
        "total_responses": total,
        "unique_respondents": unique_users,
        "promoters": promoters,
        "passives": passives,
        "detractors": detractors,
        "nps_score": nps_score,
        "average_score": avg_score,
        "response_rate": response_rate,
    }
