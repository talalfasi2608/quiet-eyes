"""
Apify API Client — Facebook group lead scraping.
"""

import os
import time
import logging
import httpx

logger = logging.getLogger(__name__)


def _get_token() -> str:
    token = os.getenv("APIFY_API_TOKEN") or os.getenv("APIFY_API_KEY", "")
    if not token:
        raise ValueError("APIFY_API_TOKEN not set")
    return token


def search_facebook(
    keywords: list[str],
    city: str,
    max_results: int = 20,
    max_wait_seconds: int = 60,
) -> list[dict]:
    """
    Search Facebook groups/posts via Apify actor.
    Returns list of post objects.
    """
    token = _get_token()
    queries = [f"{kw} {city} מחפש OR צריך OR ממליץ" for kw in keywords]

    # Start the actor run
    run_url = "https://api.apify.com/v2/acts/apify~facebook-search-scraper/runs"
    headers = {"Content-Type": "application/json", "Authorization": f"Bearer {token}"}
    body = {
        "queries": queries,
        "maxResults": max_results,
        "scrapeComments": False,
        "scrapeGroupPosts": True,
        "dateFrom": _iso_24h_ago(),
    }

    try:
        resp = httpx.post(run_url, json=body, headers=headers, timeout=30)
        run_data = resp.json()
    except Exception as e:
        logger.error(f"Apify run start failed: {e}")
        return []

    run_id = run_data.get("data", {}).get("id")
    if not run_id:
        logger.error(f"Apify returned no run ID: {run_data}")
        return []

    # Poll for completion
    poll_url = f"https://api.apify.com/v2/actor-runs/{run_id}"
    polls = max_wait_seconds // 5
    for _ in range(polls):
        time.sleep(5)
        try:
            status_resp = httpx.get(poll_url, headers={"Authorization": f"Bearer {token}"}, timeout=10)
            status = status_resp.json().get("data", {}).get("status")
            if status == "SUCCEEDED":
                break
            if status in ("FAILED", "ABORTED", "TIMED-OUT"):
                logger.error(f"Apify run {run_id} ended with status: {status}")
                return []
        except Exception:
            continue

    # Fetch results
    items_url = f"https://api.apify.com/v2/actor-runs/{run_id}/dataset/items"
    try:
        items_resp = httpx.get(items_url, headers={"Authorization": f"Bearer {token}"}, timeout=15)
        return items_resp.json() or []
    except Exception as e:
        logger.error(f"Apify results fetch failed: {e}")
        return []


def setup_webhook(actor_id: str, webhook_url: str) -> bool:
    """Register a webhook for actor run completion."""
    token = _get_token()
    try:
        resp = httpx.post(
            "https://api.apify.com/v2/webhooks",
            json={
                "eventTypes": ["ACTOR.RUN.SUCCEEDED"],
                "condition": {"actorId": actor_id},
                "requestUrl": webhook_url,
            },
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {token}",
            },
            timeout=10,
        )
        return resp.status_code < 300
    except Exception as e:
        logger.error(f"Apify webhook setup failed: {e}")
        return False


def _iso_24h_ago() -> str:
    from datetime import datetime, timezone, timedelta
    return (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
