"""
Workspace Router.

GET /workspace/me — returns the current user's workspace context.
"""

import logging
import os
from fastapi import APIRouter, HTTPException, Request, Depends
from routers._auth_helper import require_auth, get_supabase_client

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/workspace", tags=["Workspace"])


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


@router.get("/me")
async def workspace_me(request: Request, auth_user_id: str = Depends(require_auth)):
    """Return the workspace context for the authenticated user."""
    supabase = _get_service_client() or get_supabase_client(request)
    if not supabase:
        raise HTTPException(status_code=503, detail="Database unavailable")

    # Look up workspace membership
    try:
        result = (
            supabase.table("workspace_members")
            .select("workspace_id, role")
            .eq("user_id", auth_user_id)
            .execute()
        )
        if result.data and len(result.data) > 0:
            membership = result.data[0]
            ws_id = membership["workspace_id"]

            # Get workspace name
            ws = (
                supabase.table("workspaces")
                .select("name")
                .eq("id", ws_id)
                .execute()
            )
            ws_name = ws.data[0]["name"] if ws.data else "My Workspace"

            return {
                "workspace_id": ws_id,
                "workspace_name": ws_name,
                "role": membership.get("role", "owner"),
            }
    except Exception as e:
        logger.debug(f"Workspace lookup failed: {e}")

    # Default — user has no workspace yet, return a sensible default
    return {
        "workspace_id": None,
        "workspace_name": "My Workspace",
        "role": "owner",
    }
