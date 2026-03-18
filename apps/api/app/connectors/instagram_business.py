"""
Instagram Business Adapter — ingests media, comments, and engagement from connected IG accounts.

Uses the Instagram Graph API (Business/Creator accounts only) to:
1. Fetch account metadata (username, followers, media_count)
2. Fetch recent media/posts
3. Fetch comments on media (high-intent: questions, complaints, DM requests)
4. Compute engagement summaries

Falls back to mock data when access_token is missing or in dev mode.
"""

import logging
from datetime import datetime, timezone

import httpx

from app.ingestion.adapters import MentionResult

logger = logging.getLogger(__name__)

META_API_VERSION = "v19.0"
META_API_BASE = f"https://graph.facebook.com/{META_API_VERSION}"

MEDIA_FIELDS = "id,caption,media_type,timestamp,permalink,like_count,comments_count"
COMMENT_FIELDS = "id,text,timestamp,username"


class InstagramBusinessAdapter:
    """Adapter for ingesting data from a connected Instagram Business account."""

    def __init__(self, config: dict):
        """
        config keys:
          - access_token: Meta user access token with instagram_basic + instagram_manage_comments
          - ig_user_id: Instagram Business Account ID (from Facebook Page linked IG)
        """
        self.access_token = config.get("access_token", "")
        self.ig_user_id = config.get("ig_user_id", "")
        self.account_name = config.get("account_name", "Instagram Account")

    @property
    def is_configured(self) -> bool:
        return bool(self.access_token and self.ig_user_id)

    async def check_health(self) -> dict:
        """Check if the token and ig_user_id are valid."""
        if not self.is_configured:
            return {"status": "not_configured", "message": "Missing access_token or ig_user_id"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{META_API_BASE}/{self.ig_user_id}",
                    params={
                        "access_token": self.access_token,
                        "fields": "username,followers_count,media_count,biography",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "status": "ok",
                        "username": data.get("username"),
                        "followers": data.get("followers_count"),
                        "media_count": data.get("media_count"),
                    }
                body = resp.json() if "json" in resp.headers.get("content-type", "") else {}
                return {
                    "status": "error",
                    "message": body.get("error", {}).get("message", f"HTTP {resp.status_code}"),
                }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def fetch_recent_media(self, limit: int = 25) -> list[dict]:
        """Fetch recent media from the connected IG account."""
        if not self.is_configured:
            return _mock_media(self.account_name, limit)
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{META_API_BASE}/{self.ig_user_id}/media",
                    params={
                        "access_token": self.access_token,
                        "fields": MEDIA_FIELDS,
                        "limit": limit,
                    },
                )
                if resp.status_code != 200:
                    logger.warning("IG media fetch failed: %s", resp.status_code)
                    return _mock_media(self.account_name, limit)
                return resp.json().get("data", [])
        except Exception:
            logger.exception("IG media fetch error")
            return _mock_media(self.account_name, limit)

    async def fetch_media_comments(self, media_id: str, limit: int = 50) -> list[dict]:
        """Fetch comments on a specific media item."""
        if not self.is_configured:
            return []
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{META_API_BASE}/{media_id}/comments",
                    params={
                        "access_token": self.access_token,
                        "fields": COMMENT_FIELDS,
                        "limit": limit,
                    },
                )
                if resp.status_code != 200:
                    return []
                return resp.json().get("data", [])
        except Exception:
            logger.exception("IG comments fetch error for media %s", media_id)
            return []

    async def fetch_all(self, media_limit: int = 10, comment_limit: int = 20) -> list[MentionResult]:
        """Fetch media and their comments, return normalized MentionResults."""
        results: list[MentionResult] = []

        media_items = await self.fetch_recent_media(media_limit)
        for media in media_items:
            media_mention = _normalize_media(media, self.account_name)
            if media_mention:
                results.append(media_mention)

            media_id = media.get("id", "")
            if media_id and self.is_configured:
                comments = await self.fetch_media_comments(media_id, comment_limit)
                for comment in comments:
                    comment_mention = _normalize_comment(comment, self.account_name, media)
                    if comment_mention:
                        results.append(comment_mention)

        logger.info("Instagram: fetched %d items from %s", len(results), self.account_name)
        return results

    def get_engagement_summary(self, media_items: list[dict]) -> dict:
        """Compute engagement summary from media items."""
        total_likes = 0
        total_comments = 0
        for m in media_items:
            total_likes += m.get("like_count", 0)
            total_comments += m.get("comments_count", 0)

        return {
            "media_count": len(media_items),
            "total_likes": total_likes,
            "total_comments": total_comments,
            "avg_likes": round(total_likes / max(1, len(media_items)), 1),
            "avg_comments": round(total_comments / max(1, len(media_items)), 1),
        }


# ── Normalization helpers ──


def _normalize_media(media: dict, account_name: str) -> MentionResult | None:
    """Convert an Instagram media item to MentionResult."""
    caption = media.get("caption", "")
    if not caption or len(caption) < 5:
        return None

    timestamp = media.get("timestamp")
    pub_dt = None
    if timestamp:
        try:
            pub_dt = datetime.fromisoformat(timestamp.replace("+0000", "+00:00"))
        except (ValueError, AttributeError):
            pass

    likes = media.get("like_count", 0)
    comments = media.get("comments_count", 0)
    url = media.get("permalink", "")

    return MentionResult(
        title=f"IG Post by @{account_name}: {caption[:80]}",
        snippet=caption[:2000],
        url=url,
        published_at=pub_dt,
        raw_json={
            "source": "instagram_business",
            "type": "media",
            "media_type": media.get("media_type"),
            "likes": likes,
            "comments": comments,
            "media_id": media.get("id"),
        },
        source_name="Instagram",
    )


def _normalize_comment(comment: dict, account_name: str, parent_media: dict) -> MentionResult | None:
    """Convert an Instagram comment to MentionResult."""
    text = comment.get("text", "")
    if not text or len(text) < 3:
        return None

    username = comment.get("username", "someone")
    timestamp = comment.get("timestamp")
    pub_dt = None
    if timestamp:
        try:
            pub_dt = datetime.fromisoformat(timestamp.replace("+0000", "+00:00"))
        except (ValueError, AttributeError):
            pass

    media_caption = (parent_media.get("caption", "") or "")[:60]
    url = parent_media.get("permalink", "")

    return MentionResult(
        title=f"IG Comment by @{username} on \"{media_caption}...\"",
        snippet=text[:2000],
        url=url,
        published_at=pub_dt,
        raw_json={
            "source": "instagram_business",
            "type": "comment",
            "username": username,
            "comment_id": comment.get("id"),
            "media_id": parent_media.get("id"),
        },
        source_name="Instagram",
    )


# ── Mock data ──


def _mock_media(account_name: str, limit: int) -> list[dict]:
    """Return mock Instagram media for development."""
    return [
        {
            "id": f"mock_media_{i}",
            "caption": f"Sharing our journey at @{account_name}! Great things coming soon. #business #growth",
            "media_type": "IMAGE",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "permalink": "",
            "like_count": 30 + i * 10,
            "comments_count": 3 + i,
        }
        for i in range(min(limit, 3))
    ]
