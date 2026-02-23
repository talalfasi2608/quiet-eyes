"""
CRM Integration Service.

Pushes leads to external CRM systems configured per workspace.
Supports: webhook (generic), with extensible provider architecture.

The crm_integrations table schema:
  - id (int, PK)
  - workspace_id (int, FK)
  - provider (text): "webhook" | "pipedrive" | "hubspot" | "monday"
  - config (jsonb): provider-specific settings
  - is_active (bool)
  - created_at (timestamptz)
"""

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


def get_crm_config(workspace_id: int) -> Optional[dict]:
    """Fetch the active CRM integration config for a workspace."""
    supabase = _get_supabase()
    if not supabase:
        return None

    try:
        result = (
            supabase.table("crm_integrations")
            .select("*")
            .eq("workspace_id", workspace_id)
            .limit(1)
            .execute()
        )
        rows = result.data or []
        # Filter active integrations client-side (is_active column may not exist)
        for row in rows:
            if row.get("is_active", True):  # default True if column missing
                return row
        return rows[0] if rows else None
    except Exception:
        return None


def get_lead_data(lead_id: str) -> Optional[dict]:
    """Fetch full lead data from leads_discovered table."""
    supabase = _get_supabase()
    if not supabase:
        return None

    result = (
        supabase.table("leads_discovered")
        .select("*")
        .eq("id", lead_id)
        .single()
        .execute()
    )
    return result.data


def push_lead_to_crm(lead_id: str, workspace_id: int) -> dict:
    """
    Push a lead to the workspace's configured CRM.

    Returns:
        dict with "success" (bool), "provider" (str), "message" (str)
    """
    # Get CRM config
    crm_config = get_crm_config(workspace_id)
    if not crm_config:
        return {
            "success": False,
            "provider": None,
            "message": "No active CRM integration configured. Go to Settings to connect your CRM.",
        }

    # Get lead data
    lead = get_lead_data(lead_id)
    if not lead:
        return {
            "success": False,
            "provider": crm_config.get("provider"),
            "message": f"Lead {lead_id} not found",
        }

    provider = crm_config.get("provider", "webhook")
    config = crm_config.get("config", {})

    try:
        if provider == "webhook":
            return _push_webhook(lead, config)
        elif provider == "pipedrive":
            return _push_pipedrive(lead, config)
        elif provider == "hubspot":
            return _push_hubspot(lead, config)
        elif provider == "monday":
            return _push_monday(lead, config)
        else:
            return {
                "success": False,
                "provider": provider,
                "message": f"Unsupported CRM provider: {provider}",
            }
    except Exception as e:
        logger.error(f"CRM push failed ({provider}): {e}")
        return {
            "success": False,
            "provider": provider,
            "message": f"CRM push failed: {str(e)}",
        }


def _build_lead_payload(lead: dict) -> dict:
    """Build a standardized lead payload for CRM systems."""
    return {
        "lead_id": lead.get("id"),
        "title": lead.get("title", ""),
        "snippet": lead.get("snippet", ""),
        "url": lead.get("url", ""),
        "platform": lead.get("platform", ""),
        "relevance_score": lead.get("relevance_score", 0),
        "intent_category": lead.get("intent_category", ""),
        "intent_signals": lead.get("intent_signals", ""),
        "contact_info": lead.get("contact_info", ""),
        "source_query": lead.get("source_query", ""),
        "status": lead.get("status", "new"),
        "business_id": lead.get("business_id"),
        "created_at": lead.get("created_at"),
    }


def _push_webhook(lead: dict, config: dict) -> dict:
    """Push lead to a generic webhook URL."""
    webhook_url = config.get("webhook_url")
    if not webhook_url:
        return {
            "success": False,
            "provider": "webhook",
            "message": "Webhook URL not configured",
        }

    payload = _build_lead_payload(lead)
    headers = {"Content-Type": "application/json"}

    # Optional auth header
    auth_header = config.get("auth_header")
    if auth_header:
        headers["Authorization"] = auth_header

    resp = httpx.post(webhook_url, json=payload, headers=headers, timeout=15.0)
    resp.raise_for_status()

    logger.info(f"Lead {lead.get('id')} pushed to webhook: {resp.status_code}")
    return {
        "success": True,
        "provider": "webhook",
        "message": "Lead pushed successfully",
    }


def _push_pipedrive(lead: dict, config: dict) -> dict:
    """Push lead to Pipedrive CRM."""
    api_token = config.get("api_token")
    if not api_token:
        return {
            "success": False,
            "provider": "pipedrive",
            "message": "Pipedrive API token not configured",
        }

    payload = {
        "title": lead.get("title", "Quiet Eyes Lead"),
        "value": {"amount": 0, "currency": "ILS"},
        "status": "open",
    }

    # Add person if contact info available
    contact = lead.get("contact_info", "")
    if contact:
        payload["person_id"] = None  # Would need to create/find person first

    resp = httpx.post(
        f"https://api.pipedrive.com/v1/deals?api_token={api_token}",
        json=payload,
        timeout=15.0,
    )
    resp.raise_for_status()

    logger.info(f"Lead {lead.get('id')} pushed to Pipedrive")
    return {
        "success": True,
        "provider": "pipedrive",
        "message": "Lead pushed to Pipedrive",
    }


def _push_hubspot(lead: dict, config: dict) -> dict:
    """Push lead to HubSpot CRM."""
    access_token = config.get("access_token")
    if not access_token:
        return {
            "success": False,
            "provider": "hubspot",
            "message": "HubSpot access token not configured",
        }

    payload = {
        "properties": {
            "dealname": lead.get("title", "Quiet Eyes Lead"),
            "description": lead.get("snippet", ""),
            "dealstage": "appointmentscheduled",
            "pipeline": "default",
        }
    }

    resp = httpx.post(
        "https://api.hubapi.com/crm/v3/objects/deals",
        json=payload,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        timeout=15.0,
    )
    resp.raise_for_status()

    logger.info(f"Lead {lead.get('id')} pushed to HubSpot")
    return {
        "success": True,
        "provider": "hubspot",
        "message": "Lead pushed to HubSpot",
    }


def _push_monday(lead: dict, config: dict) -> dict:
    """Push lead to Monday.com board."""
    api_key = config.get("api_key")
    board_id = config.get("board_id")
    if not api_key or not board_id:
        return {
            "success": False,
            "provider": "monday",
            "message": "Monday.com API key or board ID not configured",
        }

    query = """
    mutation ($boardId: ID!, $itemName: String!, $columnValues: JSON!) {
        create_item (board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
            id
        }
    }
    """
    variables = {
        "boardId": board_id,
        "itemName": lead.get("title", "Quiet Eyes Lead"),
        "columnValues": "{}",
    }

    resp = httpx.post(
        "https://api.monday.com/v2",
        json={"query": query, "variables": variables},
        headers={
            "Authorization": api_key,
            "Content-Type": "application/json",
        },
        timeout=15.0,
    )
    resp.raise_for_status()

    logger.info(f"Lead {lead.get('id')} pushed to Monday.com")
    return {
        "success": True,
        "provider": "monday",
        "message": "Lead pushed to Monday.com",
    }
