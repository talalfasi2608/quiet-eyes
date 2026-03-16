"""
Meta Ads adapter: publishes campaign creatives to Meta (Facebook/Instagram).
Uses real Meta Marketing API if credentials are configured, otherwise mock mode.
"""

import logging
import uuid
from datetime import datetime, timezone

import httpx

logger = logging.getLogger(__name__)

META_API_VERSION = "v19.0"
META_API_BASE = f"https://graph.facebook.com/{META_API_VERSION}"


class MetaPublishResult:
    __slots__ = ("success", "external_id", "error", "response_data")

    def __init__(
        self,
        success: bool,
        external_id: str | None = None,
        error: str | None = None,
        response_data: dict | None = None,
    ):
        self.success = success
        self.external_id = external_id
        self.error = error
        self.response_data = response_data


def _build_meta_payload(campaign_draft: dict, config: dict) -> dict:
    """Build the Meta Marketing API campaign creation payload."""
    ad_account_id = config.get("ad_account_id", "act_000000")
    objective_map = {
        "LEADS": "OUTCOME_LEADS",
        "SALES": "OUTCOME_SALES",
        "TRAFFIC": "OUTCOME_TRAFFIC",
    }
    objective = objective_map.get(
        campaign_draft.get("objective", "LEADS"), "OUTCOME_LEADS"
    )

    schedule = campaign_draft.get("schedule_suggestion", {})
    creatives = campaign_draft.get("creatives", [])
    first_creative = creatives[0] if creatives else {}

    return {
        "ad_account_id": ad_account_id,
        "campaign": {
            "name": campaign_draft.get("utm", {}).get("utm_campaign", "quieteyes_campaign"),
            "objective": objective,
            "status": "PAUSED",
            "special_ad_categories": [],
        },
        "ad_set": {
            "name": f"QE AdSet — {objective}",
            "daily_budget": (schedule.get("daily_budget", 50)) * 100,  # cents
            "billing_event": "IMPRESSIONS",
            "optimization_goal": "LINK_CLICKS",
            "targeting": {
                "geo_locations": {"countries": ["US"]},
                "age_min": 18,
                "age_max": 65,
            },
        },
        "ad_creative": {
            "name": f"QE Creative",
            "title": first_creative.get("headline", ""),
            "body": first_creative.get("primary_text", ""),
            "call_to_action_type": first_creative.get("cta", "LEARN_MORE").upper().replace(" ", "_"),
        },
    }


async def publish_to_meta(
    campaign_draft: dict,
    config: dict,
) -> MetaPublishResult:
    """
    Publish a campaign to Meta.
    If access_token is configured, calls real Meta API.
    Otherwise returns a mock success.
    """
    access_token = config.get("access_token")
    if not access_token:
        return _mock_publish(campaign_draft, config)

    return await _real_publish(campaign_draft, config, access_token)


def _mock_publish(campaign_draft: dict, config: dict) -> MetaPublishResult:
    """Mock publish for development without Meta credentials."""
    mock_id = f"mock_meta_{uuid.uuid4().hex[:12]}"
    payload = _build_meta_payload(campaign_draft, config)
    logger.info("Mock Meta publish: campaign=%s", mock_id)
    return MetaPublishResult(
        success=True,
        external_id=mock_id,
        response_data={
            "mock": True,
            "campaign_id": mock_id,
            "payload_sent": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    )


async def _real_publish(
    campaign_draft: dict,
    config: dict,
    access_token: str,
) -> MetaPublishResult:
    """Attempt real Meta Marketing API publish."""
    ad_account_id = config.get("ad_account_id")
    if not ad_account_id:
        return MetaPublishResult(success=False, error="Missing ad_account_id in config")

    payload = _build_meta_payload(campaign_draft, config)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            # Step 1: Create campaign
            resp = await client.post(
                f"{META_API_BASE}/{ad_account_id}/campaigns",
                params={"access_token": access_token},
                json={
                    "name": payload["campaign"]["name"],
                    "objective": payload["campaign"]["objective"],
                    "status": "PAUSED",
                    "special_ad_categories": [],
                },
            )
            if resp.status_code != 200:
                body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                error_msg = body.get("error", {}).get("message", f"HTTP {resp.status_code}")
                return MetaPublishResult(
                    success=False,
                    error=f"Campaign creation failed: {error_msg}",
                    response_data=body,
                )

            campaign_data = resp.json()
            meta_campaign_id = campaign_data.get("id")

            return MetaPublishResult(
                success=True,
                external_id=meta_campaign_id,
                response_data={
                    "campaign_id": meta_campaign_id,
                    "status": "PAUSED",
                    "payload_sent": payload,
                },
            )
    except Exception as e:
        logger.exception("Meta publish failed")
        return MetaPublishResult(success=False, error=str(e))
