"""
CRM Router — Push leads to external CRM systems.
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/crm", tags=["crm"])


class PushLeadRequest(BaseModel):
    lead_id: str


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


@router.get("/status")
async def crm_status(auth_user_id: str = Depends(require_auth)):
    """Check if any CRM integration is available (HubSpot, webhook, etc.)."""
    hubspot_token = os.getenv("HUBSPOT_ACCESS_TOKEN") or os.getenv("HUBSPOT_API_KEY")
    if hubspot_token:
        return {"configured": True, "provider": "hubspot"}

    # Check if workspace has a CRM integration in DB
    supabase = _get_supabase()
    if supabase:
        try:
            result = (
                supabase.table("crm_integrations")
                .select("provider")
                .limit(1)
                .execute()
            )
            if result.data:
                return {"configured": True, "provider": result.data[0].get("provider", "webhook")}
        except Exception:
            pass

    return {"configured": False, "provider": None, "message": "אינטגרציית CRM אינה מוגדרת עדיין"}


@router.post("/push-lead")
async def push_lead(
    req: PushLeadRequest,
    auth_user_id: str = Depends(require_auth),
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
