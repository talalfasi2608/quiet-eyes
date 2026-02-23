"""
CRM Router — Push leads to external CRM systems.
"""

import logging
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crm", tags=["crm"])


class PushLeadRequest(BaseModel):
    lead_id: str


def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


@router.post("/push-lead")
async def push_lead(
    req: PushLeadRequest,
):
    """
    Push a lead to the workspace's configured CRM.

    Looks up the lead's business -> workspace -> CRM config,
    then dispatches to the appropriate CRM provider.
    """
    supabase = _get_supabase()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    try:
        # Get lead -> business -> workspace chain
        lead = (
            supabase.table("leads_discovered")
            .select("id, business_id")
            .eq("id", req.lead_id)
            .single()
            .execute()
        )
        if not lead.data:
            raise HTTPException(status_code=404, detail="Lead not found")

        business_id = lead.data.get("business_id")

        biz = (
            supabase.table("businesses")
            .select("workspace_id")
            .eq("id", business_id)
            .single()
            .execute()
        )
        if not biz.data or not biz.data.get("workspace_id"):
            raise HTTPException(status_code=404, detail="Business workspace not found")

        workspace_id = biz.data["workspace_id"]

        # Push to CRM
        from services.crm_service import push_lead_to_crm
        result = push_lead_to_crm(req.lead_id, workspace_id)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])

        # Log success
        try:
            from services.system_logger import get_system_logger
            get_system_logger().log(
                "info",
                "crm_push",
                f"Lead {req.lead_id} pushed to {result['provider']}",
                details={"lead_id": req.lead_id, "provider": result["provider"]},
            )
        except Exception:
            pass

        return {
            "success": True,
            "provider": result["provider"],
            "message": result["message"],
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CRM push error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
