"""
Daily Tasks Router — Generate and manage daily AI-powered tasks.
"""

import logging
from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tasks", tags=["DailyTasks"])


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


def _verify_business_owner(supabase, business_id: str, auth_user_id: str):
    try:
        result = supabase.table("businesses").select("user_id").eq("id", business_id).execute()
        rows = result.data if result else []
        if not rows:
            svc = _get_service_client()
            if svc:
                result = svc.table("businesses").select("user_id").eq("id", business_id).execute()
                rows = result.data if result else []
        if not rows:
            raise HTTPException(status_code=404, detail="Business not found")
        if rows[0].get("user_id") != auth_user_id:
            raise HTTPException(status_code=403, detail="Access denied")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Ownership check failed: {e}")
        raise HTTPException(status_code=500, detail="Ownership check failed")


@router.get("/{business_id}")
async def get_daily_tasks(business_id: str, auth_user_id: str = Depends(require_auth)):
    """Get today's tasks for a business. Generates if none exist."""
    sb = _get_service_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    _verify_business_owner(sb, business_id, auth_user_id)

    try:
        from services.daily_task_generator import get_todays_tasks
        tasks = get_todays_tasks(business_id, sb)

        # If no tasks for today, generate them
        if not tasks:
            from services.daily_task_generator import generate_daily_tasks
            tasks = generate_daily_tasks(business_id, sb)

        return {"success": True, "tasks": tasks}
    except Exception as e:
        logger.error(f"Failed to get daily tasks for {business_id}: {e}")
        return {"success": True, "tasks": []}


class CompleteTaskRequest(BaseModel):
    task_id: str


@router.post("/{business_id}/complete")
async def complete_task(business_id: str, body: CompleteTaskRequest, auth_user_id: str = Depends(require_auth)):
    """Mark a daily task as completed."""
    sb = _get_service_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    _verify_business_owner(sb, business_id, auth_user_id)

    try:
        from services.daily_task_generator import complete_task as do_complete
        do_complete(body.task_id, sb)
        return {"success": True, "message": "כל הכבוד! 💪 עוד צעד קדימה."}
    except Exception as e:
        logger.error(f"Failed to complete task {body.task_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to complete task")


@router.get("/{business_id}/health-score")
async def get_health_score(business_id: str, auth_user_id: str = Depends(require_auth)):
    """Get detailed health score with breakdown and trend."""
    sb = _get_service_client()
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")

    _verify_business_owner(sb, business_id, auth_user_id)

    try:
        from services.health_score_engine import get_health_score_engine
        engine = get_health_score_engine()
        result = engine.calculate_health_score(business_id, sb)
        return {"success": True, **result}
    except Exception as e:
        logger.error(f"Failed to calculate health score for {business_id}: {e}")
        return {"success": True, "score": 0, "components": {}, "trend": "new", "previous_score": 0}
