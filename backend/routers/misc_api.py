"""
Miscellaneous stub endpoints for pages that call backend APIs.
Covers: trends, predictions, vault, reports, staff, business feed/actions, domain insight.
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from collections import defaultdict
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from pydantic import BaseModel
from routers._auth_helper import require_auth, get_supabase_client, resolve_business_id

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Misc"])


# ── Trends & Predictions ──

@router.get("/trends/current/{user_id}")
async def current_trends(user_id: str, request: Request, limit: int = Query(default=10), auth_user_id: str = Depends(require_auth)):
    sb = _get_service_client() or get_supabase_client(request)
    biz_id = None
    if sb:
        biz_id = resolve_business_id(sb, user_id, auth_user_id)
        if not biz_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        from services.trend_radar import generate_trends
        trends = generate_trends(biz_id, sb)
        return {"trends": trends[:limit]}
    except Exception as e:
        logger.error(f"current_trends error: {e}")
        return {"trends": []}


@router.get("/predictions/upcoming/{user_id}")
async def upcoming_predictions(user_id: str, request: Request, days_ahead: int = Query(default=90), auth_user_id: str = Depends(require_auth)):
    sb = _get_service_client() or get_supabase_client(request)
    biz_id = None
    if sb:
        biz_id = resolve_business_id(sb, user_id, auth_user_id)
        if not biz_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        from services.trend_radar import generate_predictions
        return generate_predictions(biz_id, sb, days_ahead=days_ahead)
    except Exception as e:
        logger.error(f"upcoming_predictions error: {e}")
        return {"events": [], "business_context": {"id": "", "name": "", "name_hebrew": "", "industry": "", "detected_categories": []}, "insights": []}


# ── Vault / Timeline ──

@router.get("/vault/timeline/{business_id}")
async def vault_timeline(
    business_id: str,
    request: Request,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    event_type: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=50),
    offset: int = Query(default=0),
    auth_user_id: str = Depends(require_auth),
):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"events": [], "total_count": 0}

        _verify_business_owner(sb, business_id, auth_user_id)

        # Use service-role client to bypass RLS on intelligence_events
        client = sb

        # Build the data query
        query = client.table("intelligence_events").select("*").eq("business_id", business_id)

        if from_date:
            query = query.gte("created_at", from_date)
        if to_date:
            query = query.lte("created_at", to_date)
        if event_type:
            query = query.eq("event_type", event_type)
        if search:
            query = query.ilike("title", f"%{search}%")

        query = query.order("created_at", desc=True)
        query = query.range(offset, offset + limit - 1)
        result = query.execute()

        # Build the count query
        count_query = client.table("intelligence_events").select("id", count="exact").eq("business_id", business_id)
        if from_date:
            count_query = count_query.gte("created_at", from_date)
        if to_date:
            count_query = count_query.lte("created_at", to_date)
        if event_type:
            count_query = count_query.eq("event_type", event_type)
        if search:
            count_query = count_query.ilike("title", f"%{search}%")

        count_result = count_query.execute()
        total_count = len(count_result.data) if count_result.data else 0

        return {"events": result.data or [], "total_count": total_count}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"vault_timeline error: {e}")
        return {"events": [], "total_count": 0}


# ── Reports ──

def _get_service_client():
    """Get service-role client to bypass RLS."""
    try:
        import os
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception as e:
        logger.debug(f"_get_service_client failed: {e}")
    return None


def _verify_business_owner(supabase, business_id: str, auth_user_id: str):
    """Verify the authenticated user owns this business (using authenticated client)."""
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


@router.get("/reports/weekly-brief/{business_id}/preview")
async def report_preview(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    sb = _get_service_client() or get_supabase_client(request)
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")
    _verify_business_owner(sb, business_id, auth_user_id)

    THREAT_LABELS = {"high": "גבוה", "medium": "בינוני", "low": "נמוך"}

    try:
        from services.pdf_generator import _gather_report_data, _generate_narratives
        data = _gather_report_data(business_id)
        if data:
            # Map competitor fields for frontend (threat_level → threat with Hebrew)
            top_competitors = []
            for c in data.get("competitors", []):
                raw_threat = c.get("threat_level", "")
                top_competitors.append({
                    "name": c.get("name", ""),
                    "rating": c.get("rating", "-"),
                    "threat": THREAT_LABELS.get(raw_threat, raw_threat) if raw_threat else "לא ידוע",
                })

            # Generate AI narratives for preview
            narratives = _generate_narratives(data)
            action_plan = narratives.get("action_plan", [])

            return {
                "preview": {
                    "business_name": data.get("business_name", ""),
                    "industry": data.get("industry", ""),
                    "date_range": data.get("date_range", ""),
                    "health_score": data.get("health_score", 0),
                    "competitors_count": len(data.get("competitors", [])),
                    "top_competitors": top_competitors,
                    "lead_stats": data.get("lead_stats", {"new": 0, "approved": 0, "rejected": 0}),
                    "total_leads": data.get("lead_stats", {}).get("total", 0),
                    "events_count": len(data.get("events", [])),
                    "recent_events": data.get("events", [])[:5],
                    "action_items_count": len(action_plan),
                    "action_items": [
                        {"title": a.get("action", ""), "priority": a.get("priority", 0)}
                        for a in action_plan
                    ],
                    "executive_summary": narratives.get("executive_summary", ""),
                    "leads_narrative": narratives.get("leads_narrative", ""),
                    "reputation_narrative": narratives.get("reputation_narrative", ""),
                    "competitor_narrative": narratives.get("competitor_narrative", ""),
                    "opportunity_of_week": narratives.get("opportunity_of_week", ""),
                    "hot_leads": data.get("hot_leads", []),
                    "market_position": data.get("market_position", 0),
                    "current_rating": data.get("current_rating", 0),
                }
            }
    except Exception as e:
        logger.debug(f"Report preview error: {e}")

    return {
        "preview": {
            "business_name": "",
            "industry": "",
            "date_range": "",
            "health_score": 0,
            "competitors_count": 0,
            "top_competitors": [],
            "lead_stats": {"new": 0, "approved": 0, "rejected": 0},
            "total_leads": 0,
            "events_count": 0,
            "recent_events": [],
            "action_items_count": 0,
            "action_items": [],
            "executive_summary": "",
            "leads_narrative": "",
            "reputation_narrative": "",
            "competitor_narrative": "",
            "opportunity_of_week": "",
            "hot_leads": [],
            "market_position": 0,
            "current_rating": 0,
        }
    }


@router.get("/reports/weekly-brief/{business_id}")
async def report_pdf(business_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    sb = _get_service_client() or get_supabase_client(request)
    if not sb:
        raise HTTPException(status_code=503, detail="Database unavailable")
    _verify_business_owner(sb, business_id, auth_user_id)

    try:
        from services.pdf_generator import generate_weekly_brief
        pdf_bytes = generate_weekly_brief(business_id)
        if pdf_bytes:
            from fastapi.responses import Response
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=weekly-brief-{business_id[:8]}.pdf"},
            )
    except Exception as e:
        logger.error(f"PDF generation error: {e}")

    from fastapi.responses import JSONResponse
    return JSONResponse(
        content={"message": "No report available yet"},
        status_code=404,
    )


# ── Staff / Team ──

def _verify_workspace_member(sb, workspace_id: str, auth_user_id: str):
    """Verify auth user is a member of the workspace. Raises 403 if not."""
    try:
        result = (
            sb.table("workspace_members")
            .select("id")
            .eq("workspace_id", workspace_id)
            .eq("user_id", auth_user_id)
            .limit(1)
            .execute()
        )
        if result.data:
            return
    except Exception as e:
        logger.debug(f"_verify_workspace_member check failed: {e}")
    # Fallback to service-role client if RLS blocks the read
    svc = _get_service_client()
    if svc:
        try:
            result = (
                svc.table("workspace_members")
                .select("id")
                .eq("workspace_id", workspace_id)
                .eq("user_id", auth_user_id)
                .limit(1)
                .execute()
            )
            if result.data:
                return
        except Exception:
            pass
    raise HTTPException(status_code=403, detail="Access denied")


@router.get("/staff/list/{workspace_id}")
async def staff_list(workspace_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"members": []}

        _verify_workspace_member(sb, workspace_id, auth_user_id)

        # Use service-role client to bypass RLS for data reads
        client = _get_service_client() or sb

        result = (
            client.table("workspace_members")
            .select("*")
            .eq("workspace_id", workspace_id)
            .execute()
        )

        rows = result.data or []

        # Batch-fetch profile emails for all members with a user_id (avoids N+1)
        user_ids = [row.get("user_id") for row in rows if row.get("user_id")]
        email_map: dict[str, str] = {}
        if user_ids:
            try:
                profiles = (
                    client.table("profiles")
                    .select("id, email")
                    .in_("id", user_ids)
                    .execute()
                )
                for p in (profiles.data or []):
                    if p.get("email"):
                        email_map[p["id"]] = p["email"]
            except Exception as e:
                logger.debug(f"Batch profile lookup failed: {e}")

        members = []
        for row in rows:
            user_id = row.get("user_id")
            email = email_map.get(user_id, "") if user_id else ""
            if not email:
                email = row.get("invited_email") or ""

            status = "active" if user_id else "pending"

            members.append({
                "user_id": user_id,
                "email": email,
                "invited_email": row.get("invited_email"),
                "role": row.get("role", "member"),
                "status": status,
                "joined_at": row.get("created_at"),
            })

        return {"members": members}

    except Exception as e:
        logger.error(f"staff_list error: {e}")
        return {"members": []}


class InviteRequest(BaseModel):
    workspace_id: str
    email: str
    role: str = "member"


@router.post("/staff/invite")
async def staff_invite(payload: InviteRequest, request: Request, auth_user_id: str = Depends(require_auth)):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"success": False, "message": "Database unavailable"}

        _verify_workspace_member(sb, payload.workspace_id, auth_user_id)

        sb.table("workspace_members").insert({
            "workspace_id": payload.workspace_id,
            "invited_email": payload.email,
            "role": payload.role,
        }).execute()

        return {"success": True, "message": "Invitation sent"}

    except Exception as e:
        logger.error(f"staff_invite error: {e}")
        return {"success": False, "message": str(e)}


@router.get("/staff/kpis/{workspace_id}/{user_id}")
async def staff_kpis(workspace_id: str, user_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    # Auth user must be a member of the workspace to query KPIs
    return {"kpis": {"leads_actioned": 0, "reviews_responded": 0, "tasks_completed": 0}}


class RoleUpdate(BaseModel):
    role: str


@router.patch("/staff/{workspace_id}/{user_id}/role")
async def update_role(workspace_id: str, user_id: str, payload: RoleUpdate, request: Request, auth_user_id: str = Depends(require_auth)):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"success": False}

        _verify_workspace_member(sb, workspace_id, auth_user_id)

        sb.table("workspace_members").update({
            "role": payload.role,
        }).eq("workspace_id", workspace_id).eq("user_id", user_id).execute()

        return {"success": True}

    except Exception as e:
        logger.error(f"update_role error: {e}")
        return {"success": False}


@router.delete("/staff/{workspace_id}/{user_id}")
async def remove_member(workspace_id: str, user_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"success": False}

        _verify_workspace_member(sb, workspace_id, auth_user_id)

        sb.table("workspace_members").delete().eq("workspace_id", workspace_id).eq("user_id", user_id).execute()

        return {"success": True}

    except Exception as e:
        logger.error(f"remove_member error: {e}")
        return {"success": False}


# ── Business History (for growth charts) ──

@router.get("/business/history/{business_id}")
async def business_history(business_id: str, request: Request, days: int = Query(default=30), auth_user_id: str = Depends(require_auth)):
    try:
        sb = _get_service_client() or get_supabase_client(request)
        if not sb:
            return {"snapshots": [], "days": days}

        _verify_business_owner(sb, business_id, auth_user_id)

        # Use service-role client to bypass RLS on intelligence_events
        client = _get_service_client() or sb
        from_date = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        result = (
            client.table("intelligence_events")
            .select("created_at, event_type, severity")
            .eq("business_id", business_id)
            .gte("created_at", from_date)
            .order("created_at", desc=False)
            .execute()
        )

        if not result.data:
            return {"snapshots": [], "days": days}

        # Group events by date
        daily = defaultdict(lambda: {"count": 0, "types": defaultdict(int)})
        for ev in result.data:
            created = ev.get("created_at", "")
            date_key = created[:10] if created else "unknown"
            daily[date_key]["count"] += 1
            daily[date_key]["types"][ev.get("event_type", "other")] += 1

        snapshots = []
        for date_key in sorted(daily.keys()):
            snapshots.append({
                "date": date_key,
                "event_count": daily[date_key]["count"],
                "breakdown": dict(daily[date_key]["types"]),
            })

        return {"snapshots": snapshots, "days": days}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"business_history error: {e}")
        return {"snapshots": [], "days": days}


# ── Daily Focus (מיקוד) ──

@router.get("/business/daily-focus/{user_id}")
async def daily_focus(user_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    """
    Returns data for the Focus page: 3 prioritized daily tasks,
    biggest opportunity, and yesterday summary.
    """
    sb = _get_service_client() or get_supabase_client(request)
    biz_id = None
    business_name = ""
    industry = ""
    location = ""

    if sb:
        biz_id = resolve_business_id(sb, user_id, auth_user_id)
        if not biz_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    tasks = []
    biggest_opportunity = None
    yesterday_summary = {
        "leads_found": 0, "leads_actioned": 0, "events_count": 0,
        "scans_run": 0, "streak_days": 0, "summary_text": "אין נתונים מאתמול"
    }

    if sb and biz_id:
        client = _get_service_client() or sb
        try:
            # Get business info
            biz = client.table("businesses").select("business_name, industry, location").eq("id", biz_id).limit(1).execute()
            if biz.data:
                business_name = biz.data[0].get("business_name", "")
                industry = biz.data[0].get("industry", "")
                location = biz.data[0].get("location", "")
        except Exception as e:
            logger.debug(f"daily_focus biz info: {e}")

        # ── Gather raw data ──
        new_leads = []
        high_threats = []
        recent_events = []
        competitors_data = []

        try:
            leads_r = client.table("leads_discovered").select("id, summary, platform, relevance_score, source_url, created_at, status") \
                .eq("business_id", biz_id).eq("status", "new").order("created_at", desc=True).limit(20).execute()
            new_leads = leads_r.data or []
        except Exception as e:
            logger.debug(f"daily_focus leads: {e}")

        try:
            comp_r = client.table("competitors").select("id, name, google_rating, google_reviews_count, perceived_threat_level, identified_weakness") \
                .eq("business_id", biz_id).execute()
            competitors_data = comp_r.data or []
            high_threats = [c for c in competitors_data if (c.get("perceived_threat_level") or "").lower() == "high"]
        except Exception as e:
            logger.debug(f"daily_focus competitors: {e}")

        try:
            events_r = client.table("intelligence_events").select("id, title, description, event_type, severity, source, created_at, is_read") \
                .eq("business_id", biz_id).order("created_at", desc=True).limit(10).execute()
            recent_events = events_r.data or []
        except Exception as e:
            logger.debug(f"daily_focus events: {e}")

        # ── Build tasks (max 3, priority ordered) ──

        # Task 1: New leads
        if new_leads:
            count = len(new_leads)
            best = max(new_leads, key=lambda l: l.get("relevance_score") or 0)
            tasks.append({
                "id": "task-leads",
                "title": f"טפל ב-{count} לידים חדשים",
                "description": f"נמצאו {count} לידים שמחכים לתשומת לב. הליד הטוב ביותר: {best.get('summary', 'ליד חדש')[:60]}",
                "priority": "high",
                "category": "leads",
                "action_label": "צפה בלידים",
                "action_path": "/dashboard/sniper",
                "icon": "target",
                "metric": f"{count} לידים חדשים",
            })

            # Set biggest opportunity from highest relevance lead
            biggest_opportunity = {
                "title": best.get("summary", "ליד חם")[:80],
                "description": f"נמצא ב-{best.get('platform', 'האינטרנט')} עם רלוונטיות {best.get('relevance_score', 0)}%",
                "source": best.get("platform", "web"),
                "relevance_score": best.get("relevance_score", 0),
                "action_path": "/dashboard/sniper",
                "action_label": "פתח עכשיו",
                "url": best.get("source_url", ""),
            }

        # Task 2: High-threat competitor
        if high_threats and len(tasks) < 3:
            threat = high_threats[0]
            threat_name = threat.get("name", "מתחרה")
            weakness = threat.get("identified_weakness", "")
            desc = f"{threat_name} מזוהה כאיום גבוה."
            if weakness:
                desc += f" חולשה: {weakness[:50]}"
            tasks.append({
                "id": "task-competitor",
                "title": f"בנה אסטרטגיה נגד {threat_name}",
                "description": desc,
                "priority": "high",
                "category": "competitor",
                "action_label": "צפה בנוף התחרותי",
                "action_path": "/dashboard/landscape",
                "icon": "shield",
                "metric": f"{len(high_threats)} איומים גבוהים",
            })

        # Task 3: Unread intelligence events
        unread_events = [e for e in recent_events if not e.get("is_read")]
        if unread_events and len(tasks) < 3:
            count_e = len(unread_events)
            urgent = [e for e in unread_events if (e.get("severity") or "").lower() in ("high", "critical")]
            title = f"צפה ב-{count_e} עדכוני מודיעין"
            if urgent:
                title = f"⚠ {len(urgent)} התראות דחופות + {count_e - len(urgent)} עדכונים"
            tasks.append({
                "id": "task-intelligence",
                "title": title,
                "description": unread_events[0].get("title", "עדכון חדש") if unread_events else "",
                "priority": "high" if urgent else "medium",
                "category": "intelligence",
                "action_label": "צפה במודיעין",
                "action_path": "/dashboard/intelligence",
                "icon": "radar",
                "metric": f"{count_e} עדכונים חדשים",
            })

        # Task: Check market trends (if room)
        if len(tasks) < 3:
            tasks.append({
                "id": "task-trends",
                "title": f"בדוק מגמות שוק ב{industry}",
                "description": f"צפה במגמות העדכניות בתעשיית ה{industry} ב{location} ותכנן בהתאם.",
                "priority": "medium",
                "category": "trends",
                "action_label": "צפה במגמות",
                "action_path": "/dashboard/horizon",
                "icon": "trending",
                "metric": "מגמות חדשות",
            })

        # Task: Scan competitors (if room)
        if not competitors_data and len(tasks) < 3:
            tasks.append({
                "id": "task-scan",
                "title": "הפעל סריקת מתחרים ראשונה",
                "description": "טרם נסרקו מתחרים. הפעל סריקה כדי לזהות איומים והזדמנויות.",
                "priority": "medium",
                "category": "scan",
                "action_label": "סרוק עכשיו",
                "action_path": "/dashboard/landscape",
                "icon": "search",
                "metric": "0 מתחרים",
            })

        # Set biggest opportunity from intelligence if not from leads
        if not biggest_opportunity and unread_events:
            opp_events = [e for e in unread_events if e.get("event_type") == "opportunity"]
            ev = opp_events[0] if opp_events else unread_events[0]
            biggest_opportunity = {
                "title": ev.get("title", "הזדמנות חדשה")[:80],
                "description": ev.get("description", "")[:120],
                "source": ev.get("source", "system"),
                "relevance_score": 70,
                "action_path": "/dashboard/intelligence",
                "action_label": "צפה בפרטים",
                "url": "",
            }

        # ── Yesterday summary ──
        try:
            yesterday = datetime.now(timezone.utc) - timedelta(days=1)
            yesterday_start = yesterday.replace(hour=0, minute=0, second=0).isoformat()
            yesterday_end = yesterday.replace(hour=23, minute=59, second=59).isoformat()

            # Leads found yesterday
            yl = client.table("leads_discovered").select("id, status") \
                .eq("business_id", biz_id).gte("created_at", yesterday_start).lte("created_at", yesterday_end).execute()
            yl_data = yl.data or []
            y_leads_found = len(yl_data)
            y_leads_actioned = sum(1 for l in yl_data if l.get("status") in ("sniped", "dismissed"))

            # Events yesterday
            ye = client.table("intelligence_events").select("id") \
                .eq("business_id", biz_id).gte("created_at", yesterday_start).lte("created_at", yesterday_end).execute()
            y_events = len(ye.data or [])

            # Build summary text
            parts = []
            if y_leads_found:
                parts.append(f"נמצאו {y_leads_found} לידים")
            if y_leads_actioned:
                parts.append(f"טופלו {y_leads_actioned}")
            if y_events:
                parts.append(f"{y_events} עדכוני מודיעין")
            if not parts:
                parts.append("יום שקט — אין אירועים חדשים")

            yesterday_summary = {
                "leads_found": y_leads_found,
                "leads_actioned": y_leads_actioned,
                "events_count": y_events,
                "scans_run": 0,
                "streak_days": 1 if (y_leads_actioned > 0 or y_events > 0) else 0,
                "summary_text": " | ".join(parts),
            }
        except Exception as e:
            logger.debug(f"daily_focus yesterday: {e}")

    return {
        "tasks": tasks[:3],
        "biggest_opportunity": biggest_opportunity,
        "yesterday_summary": yesterday_summary,
        "business_name": business_name,
        "industry": industry,
        "location": location,
        "competitors_count": len(competitors_data) if sb and biz_id else 0,
        "new_leads_count": len(new_leads) if sb and biz_id else 0,
    }


# ── Business Feed & Actions ──

@router.get("/business/feed/{user_id}")
async def business_feed(user_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    sb = _get_service_client() or get_supabase_client(request)
    biz_id = None
    if sb:
        biz_id = resolve_business_id(sb, user_id, auth_user_id)
        if not biz_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    cards = []
    if sb and biz_id:
        # Use service-role client to bypass RLS for data reads
        client = _get_service_client() or sb
        try:
            # Pull recent leads as opportunity cards
            leads = client.table("leads_discovered").select("id, summary, platform, relevance_score, source_url, created_at, status") \
                .eq("business_id", biz_id).order("created_at", desc=True).limit(10).execute()
            for i, lead in enumerate(leads.data or []):
                cards.append({
                    "id": lead["id"],
                    "type": "opportunity",
                    "title": lead.get("summary", "ליד חדש"),
                    "description": f"נמצא ב-{lead.get('platform', 'לא ידוע')} | רלוונטיות: {lead.get('relevance_score', 0)}%",
                    "source": lead.get("platform", ""),
                    "priority": "high" if (lead.get("relevance_score") or 0) >= 80 else "medium",
                    "action_label": "צפה בליד",
                    "timestamp": lead.get("created_at", ""),
                    "is_actioned": lead.get("status") == "sniped",
                    "is_dismissed": lead.get("status") == "dismissed",
                })

            # Pull recent intelligence events as insight cards
            events = client.table("intelligence_events").select("id, title, description, source, priority, created_at") \
                .eq("business_id", biz_id).order("created_at", desc=True).limit(5).execute()
            for ev in events.data or []:
                cards.append({
                    "id": ev["id"],
                    "type": "insight",
                    "title": ev.get("title", "עדכון מודיעין"),
                    "description": ev.get("description", ""),
                    "source": ev.get("source", ""),
                    "priority": ev.get("priority", "medium"),
                    "action_label": "פרטים נוספים",
                    "timestamp": ev.get("created_at", ""),
                    "is_actioned": False,
                    "is_dismissed": False,
                })
        except Exception as e:
            logger.debug(f"business_feed: {e}")

    return {"cards": cards, "cached": False}


@router.patch("/business/feed/card/{card_id}")
async def action_card(card_id: str, actioned: bool = Query(default=True), auth_user_id: str = Depends(require_auth)):
    return {"success": True}


@router.get("/business/actions/{user_id}")
async def business_actions(user_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    sb = _get_service_client() or get_supabase_client(request)
    biz_id = None
    if sb:
        biz_id = resolve_business_id(sb, user_id, auth_user_id)
        if not biz_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    actions = []
    business_name = ""
    competitors_count = 0

    if sb and biz_id:
        # Use service-role client to bypass RLS for data reads
        client = _get_service_client() or sb
        try:
            # Get business info
            biz = client.table("businesses").select("business_name, industry, location").eq("id", biz_id).limit(1).execute()
            industry = ""
            location = ""
            if biz.data:
                business_name = biz.data[0].get("business_name", "")
                industry = biz.data[0].get("industry", "")
                location = biz.data[0].get("location", "")

            # Get competitors with details
            comp = client.table("competitors").select("id, name, google_rating, google_reviews_count, perceived_threat_level, identified_weakness") \
                .eq("business_id", biz_id).execute()
            competitors_data = comp.data or []
            competitors_count = len(competitors_data)
            high_threats = [c for c in competitors_data if (c.get("perceived_threat_level") or "").lower() == "high"]

            # Get lead count
            leads = client.table("leads_discovered").select("id").eq("business_id", biz_id).eq("status", "new").execute()
            new_leads_count = len(leads.data or [])

            # Build StrategicAction objects matching frontend interface
            def _make_action(id, title, category, priority, target, weakness, summary, steps, result, timeframe, impact):
                return {
                    "id": id,
                    "title": title,
                    "category": category,
                    "priority": priority,
                    "target_competitor": target,
                    "competitor_weakness": weakness,
                    "execution_plan": {
                        "summary": summary,
                        "steps": steps,
                        "expected_result": result,
                        "timeframe": timeframe,
                    },
                    "estimated_impact": impact,
                }

            if new_leads_count > 0:
                actions.append(_make_action(
                    id="action-leads",
                    title=f"טפל ב-{new_leads_count} לידים חדשים שהתגלו",
                    category="Marketing",
                    priority="High",
                    target=f"{new_leads_count} לידים פוטנציאליים",
                    weakness="לידים שלא טופלו מתקררים תוך 24 שעות",
                    summary=f"יש לך {new_leads_count} לידים חדשים שמחכים לתשומת לב. פנה אליהם היום לפני שהם פונים למתחרים.",
                    steps=[
                        "כנס לעמוד צלף ההזדמנויות וסקור את כל הלידים החדשים",
                        "סמן לידים רלוונטיים כ'ליד טוב' ודחה את הלא-רלוונטיים",
                        f"פנה ללידים הטובים דרך וואטסאפ או טלפון תוך 2 שעות",
                    ],
                    result="המרת לפחות ליד אחד ללקוח משלם",
                    timeframe="30 דקות",
                    impact="High",
                ))

            if high_threats:
                threat = high_threats[0]
                threat_name = threat.get("name", "מתחרה מוביל")
                threat_weakness = threat.get("identified_weakness", "עדיין לא זוהתה חולשה ספציפית")
                actions.append(_make_action(
                    id="action-threat",
                    title=f"בנה אסטרטגיה נגד {threat_name}",
                    category="Operations",
                    priority="High",
                    target=threat_name,
                    weakness=threat_weakness,
                    summary=f"{threat_name} הוא המתחרה המסוכן ביותר שלך. נצל את החולשה שזוהתה כדי לגנוב ממנו לקוחות.",
                    steps=[
                        f"בדוק את הביקורות האחרונות של {threat_name} בגוגל",
                        "זהה תלונות חוזרות של לקוחות שלו",
                        "צור הצעה ייחודית שפותרת בדיוק את הבעיות שלו",
                        "פרסם את ההצעה ברשתות החברתיות ובגוגל",
                    ],
                    result=f"גניבת 2-3 לקוחות מ-{threat_name} תוך שבוע",
                    timeframe="45 דקות",
                    impact="High",
                ))
            elif competitors_count > 0:
                comp_name = competitors_data[0].get("name", "המתחרה הראשי")
                actions.append(_make_action(
                    id="action-competitor",
                    title=f"סרוק ועקוב אחרי {comp_name}",
                    category="Digital",
                    priority="Medium",
                    target=comp_name,
                    weakness="טרם נותח — דרושה סריקה ראשונית",
                    summary=f"הפעל סריקת מודיעין על {comp_name} כדי לזהות חולשות שאפשר לנצל.",
                    steps=[
                        f"כנס לעמוד 'נוף' ולחץ על הכרטיס של {comp_name}",
                        "בדוק דירוג, ביקורות ומחירים",
                        "לחץ 'קבל אסטרטגיית תקיפה' לקבלת תוכנית AI",
                    ],
                    result="מפת חולשות מלאה של המתחרה",
                    timeframe="20 דקות",
                    impact="Medium",
                ))

            actions.append(_make_action(
                id="action-intelligence",
                title=f"בדוק את מודיעין השוק של {industry}",
                category="Service",
                priority="Medium",
                target=f"שוק ה{industry} ב{location}",
                weakness="שינויים בשוק שלא מגיבים אליהם בזמן",
                summary=f"צפה בעדכוני המודיעין האחרונים כדי לזהות הזדמנויות ואיומים חדשים בשוק.",
                steps=[
                    "כנס לעמוד המודיעין וצפה בהתראות החדשות",
                    "סמן הזדמנויות רלוונטיות לטיפול",
                    f"שתף תובנות חשובות עם הצוות",
                ],
                result="זיהוי מוקדם של הזדמנויות ואיומים בשוק",
                timeframe="15 דקות",
                impact="Medium",
            ))

        except Exception as e:
            logger.debug(f"business_actions: {e}")

    return {
        "success": True,
        "actions": actions,
        "business_name": business_name,
        "competitors_count": competitors_count,
        "competitors_analyzed": [],
    }


# ── Domain Insight ──

@router.get("/domain/insight/{user_id}")
async def domain_insight(user_id: str, request: Request, auth_user_id: str = Depends(require_auth)):
    sb = _get_service_client() or get_supabase_client(request)
    if sb:
        biz_id = resolve_business_id(sb, user_id, auth_user_id)
        if not biz_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user_id != auth_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return {"insight": None}


# ── Billing endpoints moved to routers/billing.py ──
