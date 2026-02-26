"""
Beta Waitlist Router

Handles waitlist signups, referral tracking, admin invitations,
and waitlist statistics for the beta launch.
"""

import os
import string
import random
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, EmailStr
from typing import Optional

from routers._auth_helper import require_auth

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/waitlist", tags=["Beta Waitlist"])


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


def _generate_referral_code() -> str:
    """Generate a unique 8-character referral code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=8))


# ═══════════════════════════════════════════════════════════════════════════════
# MODELS
# ═══════════════════════════════════════════════════════════════════════════════

class WaitlistJoinRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = None
    business_type: Optional[str] = None
    source: Optional[str] = "organic"
    referral_code: Optional[str] = None


class InviteBatchRequest(BaseModel):
    count: int


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/join")
async def join_waitlist(body: WaitlistJoinRequest):
    """
    Public endpoint — join the beta waitlist.
    If a referral_code is provided, links the referrer and bumps them up 3 positions.
    """
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Check for duplicate email
    existing = (
        supabase.table("beta_waitlist")
        .select("id, position, referral_code, status")
        .eq("email", body.email.lower().strip())
        .limit(1)
        .execute()
    )
    if existing.data:
        entry = existing.data[0]
        # Count how many are ahead
        ahead = (
            supabase.table("beta_waitlist")
            .select("id", count="exact")
            .lt("position", entry["position"])
            .eq("status", "waiting")
            .execute()
        )
        return {
            "success": True,
            "already_joined": True,
            "position": entry["position"],
            "referral_code": entry["referral_code"],
            "total_ahead": ahead.count or 0,
            "status": entry["status"],
        }

    # Get next position
    max_pos = (
        supabase.table("beta_waitlist")
        .select("position")
        .order("position", desc=True)
        .limit(1)
        .execute()
    )
    next_position = (max_pos.data[0]["position"] + 1) if max_pos.data else 1

    # Generate unique referral code
    referral_code = _generate_referral_code()
    for _ in range(5):  # retry up to 5 times for uniqueness
        check = (
            supabase.table("beta_waitlist")
            .select("id")
            .eq("referral_code", referral_code)
            .limit(1)
            .execute()
        )
        if not check.data:
            break
        referral_code = _generate_referral_code()

    # Resolve referrer
    referred_by_id = None
    source = body.source or "organic"
    if body.referral_code:
        referrer = (
            supabase.table("beta_waitlist")
            .select("id, position")
            .eq("referral_code", body.referral_code.upper().strip())
            .limit(1)
            .execute()
        )
        if referrer.data:
            referred_by_id = referrer.data[0]["id"]
            source = "referral"

            # Bump referrer up 3 positions
            old_pos = referrer.data[0]["position"]
            new_pos = max(1, old_pos - 3)
            if new_pos < old_pos:
                # Move everyone between new_pos and old_pos-1 down by 1
                supabase.rpc("bump_waitlist_positions", {
                    "old_position": old_pos,
                    "new_position": new_pos,
                }).execute()
                # Update referrer position
                supabase.table("beta_waitlist").update(
                    {"position": new_pos}
                ).eq("id", referred_by_id).execute()

    # Insert new entry
    insert_data = {
        "name": body.name.strip(),
        "email": body.email.lower().strip(),
        "phone": body.phone.strip() if body.phone else None,
        "business_type": body.business_type,
        "referral_code": referral_code,
        "referred_by": referred_by_id,
        "position": next_position,
        "status": "waiting",
        "source": source,
    }

    result = supabase.table("beta_waitlist").insert(insert_data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to join waitlist")

    # Count total ahead
    ahead = (
        supabase.table("beta_waitlist")
        .select("id", count="exact")
        .lt("position", next_position)
        .eq("status", "waiting")
        .execute()
    )

    logger.info(f"[Waitlist] New signup: {body.email} at position {next_position}")

    return {
        "success": True,
        "already_joined": False,
        "position": next_position,
        "referral_code": referral_code,
        "total_ahead": ahead.count or 0,
    }


@router.get("/status/{email}")
async def get_waitlist_status(email: str):
    """Public endpoint — check waitlist status by email."""
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    entry = (
        supabase.table("beta_waitlist")
        .select("id, position, referral_code, status, created_at")
        .eq("email", email.lower().strip())
        .limit(1)
        .execute()
    )
    if not entry.data:
        raise HTTPException(status_code=404, detail="Email not found in waitlist")

    row = entry.data[0]

    # Count referrals
    referral_count = (
        supabase.table("beta_waitlist")
        .select("id", count="exact")
        .eq("referred_by", row["id"])
        .execute()
    )

    # Count people ahead
    ahead = (
        supabase.table("beta_waitlist")
        .select("id", count="exact")
        .lt("position", row["position"])
        .eq("status", "waiting")
        .execute()
    )

    return {
        "success": True,
        "position": row["position"],
        "referral_code": row["referral_code"],
        "referral_count": referral_count.count or 0,
        "total_ahead": ahead.count or 0,
        "status": row["status"],
        "joined_at": row["created_at"],
    }


@router.get("/count")
async def get_waitlist_count():
    """Public endpoint — get total waitlist signups count."""
    supabase = _get_service_client()
    if not supabase:
        return {"count": 0}

    result = (
        supabase.table("beta_waitlist")
        .select("id", count="exact")
        .execute()
    )
    return {"count": result.count or 0}


# ═══════════════════════════════════════════════════════════════════════════════
# ADMIN ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@router.post("/invite/{waitlist_id}")
async def invite_user(
    waitlist_id: str,
    auth_user_id: str = Depends(require_auth),
):
    """Admin only — invite a specific waitlist user."""
    _require_super_admin(auth_user_id)
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Get the entry
    entry = (
        supabase.table("beta_waitlist")
        .select("*")
        .eq("id", waitlist_id)
        .limit(1)
        .execute()
    )
    if not entry.data:
        raise HTTPException(status_code=404, detail="Waitlist entry not found")

    row = entry.data[0]
    if row["status"] != "waiting":
        return {"success": True, "message": f"Already {row['status']}"}

    # Update status
    supabase.table("beta_waitlist").update({
        "status": "invited",
        "invited_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", waitlist_id).execute()

    # Send WhatsApp invite if phone available
    if row.get("phone"):
        try:
            from services.whatsapp import send_whatsapp_message
            message = (
                f"שלום {row['name']}! 🎉\n\n"
                f"יש לנו חדשות מצוינות — הגיע התור שלך!\n"
                f"קיבלת הזמנה לבטא הסגורה של Quieteyes.\n\n"
                f"להתחיל עכשיו: https://app.quieteyes.co.il/login\n\n"
                f"מקומות מוגבלים — נשמח לראות אותך בפנים!"
            )
            send_whatsapp_message(row["phone"], message)
            logger.info(f"[Waitlist] Invite WhatsApp sent to {row['email']}")
        except Exception as e:
            logger.warning(f"[Waitlist] WhatsApp invite failed: {e}")

    return {"success": True, "message": f"Invited {row['email']}"}


@router.post("/invite-batch")
async def invite_batch(
    body: InviteBatchRequest,
    auth_user_id: str = Depends(require_auth),
):
    """Admin only — invite top N users from the waitlist by position."""
    _require_super_admin(auth_user_id)
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    count = min(body.count, 50)  # Cap at 50

    # Get top N waiting entries
    entries = (
        supabase.table("beta_waitlist")
        .select("*")
        .eq("status", "waiting")
        .order("position")
        .limit(count)
        .execute()
    )

    invited = 0
    for row in entries.data or []:
        supabase.table("beta_waitlist").update({
            "status": "invited",
            "invited_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", row["id"]).execute()

        # Send WhatsApp if phone available
        if row.get("phone"):
            try:
                from services.whatsapp import send_whatsapp_message
                message = (
                    f"שלום {row['name']}! 🎉\n\n"
                    f"יש לנו חדשות מצוינות — הגיע התור שלך!\n"
                    f"קיבלת הזמנה לבטא הסגורה של Quieteyes.\n\n"
                    f"להתחיל עכשיו: https://app.quieteyes.co.il/login\n\n"
                    f"מקומות מוגבלים — נשמח לראות אותך בפנים!"
                )
                send_whatsapp_message(row["phone"], message)
            except Exception:
                pass

        invited += 1

    logger.info(f"[Waitlist] Batch invited {invited} users")
    return {"success": True, "invited": invited}


@router.get("/stats")
async def get_waitlist_stats(
    auth_user_id: str = Depends(require_auth),
):
    """Admin only — get waitlist statistics."""
    _require_super_admin(auth_user_id)
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Counts by status
    all_entries = (
        supabase.table("beta_waitlist")
        .select("id, status, source, referred_by, referral_code, name, email")
        .order("position")
        .execute()
    )
    rows = all_entries.data or []

    total = len(rows)
    waiting = sum(1 for r in rows if r["status"] == "waiting")
    invited = sum(1 for r in rows if r["status"] == "invited")
    activated = sum(1 for r in rows if r["status"] == "activated")
    churned = sum(1 for r in rows if r["status"] == "churned")

    conversion_rate = round((activated / invited * 100), 1) if invited > 0 else 0

    # Signups by source
    source_counts: dict[str, int] = {}
    for r in rows:
        s = r.get("source", "organic")
        source_counts[s] = source_counts.get(s, 0) + 1

    # Top referrers
    referral_counts: dict[str, int] = {}
    referral_names: dict[str, str] = {}
    for r in rows:
        if r.get("referred_by"):
            ref_id = r["referred_by"]
            referral_counts[ref_id] = referral_counts.get(ref_id, 0) + 1
    for r in rows:
        if r["id"] in referral_counts:
            referral_names[r["id"]] = r.get("name", r.get("email", "Unknown"))

    top_referrers = sorted(
        [
            {"id": rid, "name": referral_names.get(rid, "Unknown"), "count": cnt}
            for rid, cnt in referral_counts.items()
        ],
        key=lambda x: x["count"],
        reverse=True,
    )[:10]

    return {
        "success": True,
        "total": total,
        "total_waiting": waiting,
        "total_invited": invited,
        "total_activated": activated,
        "total_churned": churned,
        "conversion_rate": conversion_rate,
        "signups_by_source": source_counts,
        "top_referrers": top_referrers,
    }


@router.get("/entries")
async def get_waitlist_entries(
    auth_user_id: str = Depends(require_auth),
    status: Optional[str] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
):
    """Admin only — get paginated waitlist entries."""
    _require_super_admin(auth_user_id)
    supabase = _get_service_client()
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    q = supabase.table("beta_waitlist").select("*", count="exact").order("position")
    if status:
        q = q.eq("status", status)

    result = q.range(offset, offset + limit - 1).execute()

    # Enrich with referral counts
    entries = result.data or []
    entry_ids = [e["id"] for e in entries]
    if entry_ids:
        all_referrals = (
            supabase.table("beta_waitlist")
            .select("referred_by")
            .in_("referred_by", entry_ids)
            .execute()
        )
        ref_counts: dict[str, int] = {}
        for r in all_referrals.data or []:
            ref_id = r["referred_by"]
            ref_counts[ref_id] = ref_counts.get(ref_id, 0) + 1

        for e in entries:
            e["referral_count"] = ref_counts.get(e["id"], 0)

    return {
        "success": True,
        "entries": entries,
        "total": result.count or 0,
    }
