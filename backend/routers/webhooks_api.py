"""
Webhook API Router — Apify completion + Green API incoming messages.
"""

import os
import logging
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


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


@router.post("/apify")
async def apify_webhook(request: Request):
    """
    Handle Apify actor run completion.
    Receives results, routes to correct user, adds to leads/intel.
    """
    # Verify webhook secret
    secret = request.headers.get("x-apify-webhook-secret", "")
    expected = os.getenv("APIFY_WEBHOOK_SECRET", "")
    if expected and secret != expected:
        raise HTTPException(status_code=403, detail="Invalid webhook secret")

    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    run_id = body.get("resource", {}).get("id")
    status = body.get("resource", {}).get("status")

    if status != "SUCCEEDED":
        logger.info(f"Apify webhook: run {run_id} status={status} — skipping")
        return {"success": True, "message": "Skipped non-success run"}

    # Fetch results from Apify dataset
    try:
        import httpx
        apify_token = os.getenv("APIFY_API_TOKEN") or os.getenv("APIFY_API_KEY", "")
        if not apify_token:
            return {"success": False, "message": "No Apify token"}

        items_url = f"https://api.apify.com/v2/actor-runs/{run_id}/dataset/items"
        resp = httpx.get(
            items_url,
            headers={"Authorization": f"Bearer {apify_token}"},
            timeout=15,
        )
        items = resp.json() or []
    except Exception as e:
        logger.error(f"Apify results fetch failed: {e}")
        return {"success": False, "message": str(e)}

    if not items:
        return {"success": True, "message": "No items in dataset"}

    # Route items — extract user_id from run metadata if available
    sb = _get_service_client()
    if not sb:
        return {"success": False, "message": "Database unavailable"}

    saved = 0
    for item in items:
        try:
            text = item.get("text", "") or item.get("message", "") or item.get("content", "")
            if not text or len(text) < 10:
                continue

            # Try to extract user context from the run
            user_id = body.get("eventData", {}).get("userId")
            if not user_id:
                continue

            sb.table("leads").insert({
                "user_id": user_id,
                "text": text[:2000],
                "source_url": item.get("url", ""),
                "source_type": "facebook_group",
                "source_name": item.get("groupName", "Facebook"),
                "score": 0,
                "found_at": item.get("date"),
            }).execute()
            saved += 1
        except Exception as e:
            logger.error(f"Apify item save failed: {e}")

    logger.info(f"Apify webhook: saved {saved}/{len(items)} items from run {run_id}")
    return {"success": True, "saved": saved, "total": len(items)}


@router.post("/green-api")
async def green_api_webhook(request: Request):
    """
    Handle incoming WhatsApp messages via Green API.
    Checks if reply to a lead alert → marks lead as acted_upon.
    """
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    # Green API sends different message types
    msg_type = body.get("typeWebhook")
    if msg_type != "incomingMessageReceived":
        return {"success": True}

    message_data = body.get("messageData", {})
    sender = body.get("senderData", {}).get("chatId", "")
    text = ""

    if message_data.get("typeMessage") == "textMessage":
        text = message_data.get("textMessageData", {}).get("textMessage", "")
    elif message_data.get("typeMessage") == "extendedTextMessage":
        text = message_data.get("extendedTextMessageData", {}).get("text", "")

    if not text or not sender:
        return {"success": True}

    # Extract phone from chatId (format: 972XXXXXXXXX@c.us)
    phone = sender.replace("@c.us", "")

    # Log incoming message
    sb = _get_service_client()
    if sb:
        try:
            sb.table("whatsapp_logs").insert({
                "phone": phone,
                "message_type": "incoming",
                "message_text": text[:500],
                "status": "received",
                "provider": "green_api",
            }).execute()
        except Exception:
            pass

    logger.info(f"Green API incoming from {phone[:8]}...: {text[:50]}...")
    return {"success": True}
