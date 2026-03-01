"""
Agents API Router — Agent status, trigger, feedback endpoints.
"""

import logging
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/agents", tags=["Agents"])


def _get_service_client():
    try:
        import os
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


@router.get("/status")
async def get_agents_status(auth_user_id: str = Depends(require_auth)):
    """Get status of all 6 agents."""
    try:
        from agents.monitor import get_agent_status
        agents = get_agent_status()
        return {"success": True, "agents": agents}
    except Exception as e:
        logger.error(f"Agent status failed: {e}")
        return {"success": True, "agents": []}


@router.get("/info")
async def get_agents_info(auth_user_id: str = Depends(require_auth)):
    """Get info about all agents (for settings page)."""
    try:
        from agents.scheduler import get_all_agent_info
        return {"success": True, "agents": get_all_agent_info()}
    except Exception as e:
        logger.error(f"Agent info failed: {e}")
        return {"success": True, "agents": []}


class TriggerRequest(BaseModel):
    agent_name: str
    business_id: str


@router.post("/trigger")
async def trigger_agent(body: TriggerRequest, auth_user_id: str = Depends(require_auth)):
    """Manually trigger an agent for a specific business."""
    sb = _get_service_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Verify ownership
    try:
        result = sb.table("businesses").select("user_id").eq("id", body.business_id).execute()
        if not result.data or result.data[0].get("user_id") != auth_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Ownership check failed")

    valid_agents = ["eyeni", "hamoa", "hakol", "hakis", "haozen", "hatavach"]
    if body.agent_name not in valid_agents:
        raise HTTPException(status_code=400, detail=f"Unknown agent: {body.agent_name}")

    try:
        from agents.scheduler import run_agent_single
        import threading
        # Run in background thread to not block the request
        result_holder = {"result": None}

        def run():
            result_holder["result"] = run_agent_single(body.agent_name, body.business_id)

        t = threading.Thread(target=run, daemon=True)
        t.start()

        return {
            "success": True,
            "message": f"⟳ {body.agent_name} מתחיל לסרוק...",
        }
    except Exception as e:
        logger.error(f"Agent trigger failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to trigger agent")


class FeedbackRequest(BaseModel):
    finding_id: str
    was_relevant: bool
    led_to_customer: bool = False


@router.post("/feedback")
async def submit_feedback(body: FeedbackRequest, auth_user_id: str = Depends(require_auth)):
    """Submit feedback on an agent finding (for learning system)."""
    try:
        from agents.learning import record_feedback
        record_feedback(auth_user_id, body.finding_id, body.was_relevant, body.led_to_customer)
        return {"success": True, "message": "תודה! עיני ילמד מזה 🎯"}
    except Exception as e:
        logger.error(f"Feedback failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save feedback")


@router.get("/runs/{agent_name}")
async def get_agent_runs(agent_name: str, auth_user_id: str = Depends(require_auth)):
    """Get recent runs for an agent (admin view)."""
    try:
        from agents.monitor import get_recent_runs
        runs = get_recent_runs(agent_name, limit=20)
        return {"success": True, "runs": runs}
    except Exception as e:
        logger.error(f"Agent runs failed: {e}")
        return {"success": True, "runs": []}


@router.get("/usage/today")
async def get_today_usage(auth_user_id: str = Depends(require_auth)):
    """Get total AI token usage today."""
    try:
        from agents.monitor import get_today_token_usage
        tokens = get_today_token_usage()
        return {"success": True, "tokens": tokens}
    except Exception as e:
        return {"success": True, "tokens": 0}


@router.get("/marketing-plan/{business_id}")
async def get_marketing_plan(business_id: str, auth_user_id: str = Depends(require_auth)):
    """Get the latest marketing plan for a business."""
    sb = _get_service_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Verify ownership
    try:
        result = sb.table("businesses").select("user_id").eq("id", business_id).execute()
        if not result.data or result.data[0].get("user_id") != auth_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Check failed")

    try:
        result = sb.table("marketing_plans").select("*").eq(
            "business_id", business_id
        ).order("week_start", desc=True).limit(1).execute()

        if result.data:
            plan = result.data[0]
            # Parse posts if stored as string
            posts = plan.get("posts", "[]")
            if isinstance(posts, str):
                import json
                posts = json.loads(posts)
            plan["posts"] = posts
            return {"success": True, "plan": plan}

        return {"success": True, "plan": None}
    except Exception as e:
        logger.error(f"Marketing plan fetch failed: {e}")
        return {"success": True, "plan": None}
