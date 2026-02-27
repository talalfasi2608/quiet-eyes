"""
Leads Router — feed, sniping, feedback.
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query, Request, Depends
from pydantic import BaseModel
from routers._auth_helper import require_auth, get_supabase_client
from services.permission_engine import require_feature

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/leads", tags=["Leads"])


def _get_service_client():
    """Get service-role client to bypass RLS for ownership checks."""
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
    """Verify the authenticated user owns this business."""
    try:
        result = (
            supabase.table("businesses")
            .select("user_id")
            .eq("id", business_id)
            .execute()
        )
        rows = result.data if result else []
        # Fallback to service-role client if RLS blocks the read
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
        logger.error(f"Business ownership check failed: {e}")
        raise HTTPException(status_code=500, detail="Ownership check failed")


@router.get("/{business_id}")
async def list_leads(business_id: str, request: Request, auth_user_id: str = Depends(require_auth), limit: int = Query(default=50), status: Optional[str] = None):
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        return {"success": True, "leads": [], "counts": {"new": 0, "sniped": 0, "dismissed": 0}, "total": 0}

    _verify_business_owner(supabase, business_id, auth_user_id)

    leads = []
    try:
        # Use service-role client to bypass RLS on leads_discovered
        sb = _get_service_client() or supabase
        q = sb.table("leads_discovered").select("*").eq("business_id", business_id).limit(limit)
        if status and status != "all":
            q = q.eq("status", status)
        r = q.order("created_at", desc=True).execute()
        if r and r.data:
            leads = r.data
    except Exception as e:
        logger.debug(f"Leads lookup: {e}")

    # Compute counts from data
    new_count = sum(1 for l in leads if l.get("status") == "new")
    approved_count = sum(1 for l in leads if l.get("status") == "sniped")
    rejected_count = sum(1 for l in leads if l.get("status") == "dismissed")

    # Last scan timestamp
    last_scan_at = None
    try:
        sb2 = _get_service_client() or supabase
        job_res = (
            sb2.table("scheduled_jobs")
            .select("last_run_at")
            .eq("business_id", business_id)
            .eq("job_type", "lead_snipe")
            .maybe_single()
            .execute()
        )
        if job_res and job_res.data:
            last_scan_at = job_res.data.get("last_run_at")
    except Exception:
        pass

    return {
        "success": True,
        "leads": leads,
        "counts": {"new": new_count, "sniped": approved_count, "dismissed": rejected_count},
        "total": len(leads),
        "last_scan_at": last_scan_at,
    }


@router.get("/{business_id}/export")
async def export_leads_csv(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    """Export leads as CSV."""
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    _verify_business_owner(supabase, business_id, auth_user_id)

    try:
        sb = _get_service_client() or supabase
        r = sb.table("leads_discovered").select("*").eq("business_id", business_id).order("created_at", desc=True).limit(500).execute()
        leads = r.data or []
    except Exception as e:
        logger.error(f"Export leads error: {e}")
        leads = []

    import csv
    import io
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Platform", "Summary", "Score", "Status", "Source URL", "Created At"])
    for lead in leads:
        writer.writerow([
            lead.get("id", ""),
            lead.get("platform", ""),
            lead.get("summary", ""),
            lead.get("relevance_score", ""),
            lead.get("status", ""),
            lead.get("source_url", ""),
            lead.get("created_at", ""),
        ])

    from fastapi.responses import Response
    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=leads-{business_id[:8]}.csv"},
    )


@router.post("/snipe/{business_id}")
async def snipe_leads(business_id: str, request: Request, auth_user_id: str = Depends(require_auth), _perm=Depends(require_feature("leads_scans_per_month"))):
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    _verify_business_owner(supabase, business_id, auth_user_id)

    try:
        from services.lead_sniper import get_lead_sniper
        sniper = get_lead_sniper()
        # Use service-role client for sniping (needs to read businesses + insert leads, bypassing RLS)
        sb = _get_service_client() or supabase
        report = sniper.sniping_mission(business_id, sb)
        return {
            "success": True,
            "message": "Sniping mission completed",
            "leads_found": report.leads_found,
            "leads_saved": report.leads_saved,
            "total_scanned": report.total_results_scanned,
            "source_counts": report.source_counts,
            "leads": report.leads,
            "errors": report.errors,
        }
    except Exception as e:
        logger.error(f"Sniping mission failed for {business_id}: {e}")
        raise HTTPException(status_code=500, detail="Sniping mission failed")


@router.post("/refresh/{business_id}")
async def refresh_leads(business_id: str, request: Request, auth_user_id: str = Depends(require_auth), _perm=Depends(require_feature("leads_scans_per_month"))):
    """
    Force-refresh leads: archive stale 'new' leads older than 24h, then trigger a fresh scan.
    Solves the "same leads showing from yesterday" problem.
    """
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")
    _verify_business_owner(supabase, business_id, auth_user_id)

    sb = _get_service_client() or supabase
    archived = 0

    # Archive stale 'new' leads older than 24 hours
    try:
        from datetime import datetime, timezone, timedelta
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
        stale = (
            sb.table("leads_discovered")
            .select("id")
            .eq("business_id", business_id)
            .eq("status", "new")
            .lt("created_at", cutoff)
            .execute()
        )
        stale_ids = [r["id"] for r in (stale.data or [])]
        if stale_ids:
            for sid in stale_ids:
                sb.table("leads_discovered").update({"status": "dismissed"}).eq("id", sid).execute()
                archived += 1
    except Exception as e:
        logger.debug(f"Lead archival: {e}")

    # Trigger fresh scan
    try:
        from services.lead_sniper import get_lead_sniper
        sniper = get_lead_sniper()
        report = sniper.sniping_mission(business_id, sb)
        return {
            "success": True,
            "message": "Leads refreshed",
            "archived_stale": archived,
            "leads_found": report.leads_found,
            "leads_saved": report.leads_saved,
            "total_scanned": report.total_results_scanned,
            "source_counts": report.source_counts,
            "errors": report.errors,
        }
    except Exception as e:
        logger.error(f"Lead refresh failed for {business_id}: {e}")
        raise HTTPException(status_code=500, detail="Lead refresh failed")


@router.get("/{business_id}/feedback-stats")
async def feedback_stats(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        return {"success": True, "total_feedback": 0, "approval_rate": 0, "approvals": 0, "rejections": 0, "dismissals": 0, "top_rejection_reason": None}

    _verify_business_owner(supabase, business_id, auth_user_id)

    try:
        # Use service-role client to bypass RLS on leads_discovered
        sb = _get_service_client() or supabase
        result = (
            sb.table("leads_discovered")
            .select("status")
            .eq("business_id", business_id)
            .neq("status", "new")
            .execute()
        )
        feedback_data = (result.data if result else []) or []
        approvals = sum(1 for l in feedback_data if l.get("status") == "sniped")
        rejections = sum(1 for l in feedback_data if l.get("status") == "dismissed")
        total = approvals + rejections
        approval_rate = (approvals / total) if total > 0 else 0

        return {
            "success": True,
            "total_feedback": total,
            "approval_rate": approval_rate,
            "approvals": approvals,
            "rejections": rejections,
            "dismissals": 0,
            "top_rejection_reason": None,
        }
    except Exception as e:
        logger.debug(f"Feedback stats: {e}")
        return {"success": True, "total_feedback": 0, "approval_rate": 0, "approvals": 0, "rejections": 0, "dismissals": 0, "top_rejection_reason": None}


class FeedbackRequest(BaseModel):
    user_id: str
    action: str  # 'approve' | 'reject' | 'dismiss'
    rejection_reason: Optional[str] = None


@router.post("/{lead_id}/feedback")
async def submit_feedback(lead_id: str, payload: FeedbackRequest, request: Request, auth_user_id: str = Depends(require_auth)):
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        return {"success": False, "message": "Database unavailable"}

    # Verify ownership: look up the lead's business_id, then verify the user owns that business
    try:
        sb = _get_service_client() or supabase
        lead_result = sb.table("leads_discovered").select("business_id").eq("id", lead_id).limit(1).execute()
        if lead_result.data:
            _verify_business_owner(supabase, lead_result.data[0]["business_id"], auth_user_id)
        else:
            raise HTTPException(status_code=404, detail="Lead not found")
    except HTTPException:
        raise
    except Exception as e:
        logger.debug(f"Lead ownership check: {e}")
        raise HTTPException(status_code=403, detail="Access denied")

    # Map action to DB status value
    status_map = {"approve": "sniped", "reject": "dismissed", "dismiss": "dismissed"}
    new_status = status_map.get(payload.action, payload.action)

    try:
        sb = _get_service_client() or supabase
        update_data = {"status": new_status}
        if new_status == "sniped":
            from datetime import datetime, timezone
            update_data["sniped_at"] = datetime.now(timezone.utc).isoformat()
        sb.table("leads_discovered").update(update_data).eq("id", lead_id).execute()
    except Exception as e:
        logger.debug(f"Lead feedback: {e}")
    return {"success": True}
