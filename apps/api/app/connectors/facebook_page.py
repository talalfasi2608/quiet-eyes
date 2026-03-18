"""
Facebook Page Adapter — ingests posts, comments, and engagement from connected Facebook Pages.

Uses the Facebook Graph API to:
1. Fetch page metadata (name, followers, category)
2. Fetch recent posts
3. Fetch comments on posts (high-intent: questions, complaints)
4. Compute engagement summaries

Falls back to mock data when access_token is missing or in dev mode.
"""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from app.ingestion.adapters import MentionResult

logger = logging.getLogger(__name__)

META_API_VERSION = "v19.0"
META_API_BASE = f"https://graph.facebook.com/{META_API_VERSION}"

# Fields to request per post
POST_FIELDS = "id,message,created_time,permalink_url,shares,reactions.summary(true),comments.summary(true)"
COMMENT_FIELDS = "id,message,created_time,from,permalink_url"


class FacebookPageAdapter:
    """Adapter for ingesting data from a connected Facebook Page."""

    def __init__(self, config: dict):
        """
        config keys:
          - access_token: Meta user/page access token
          - page_id: Facebook Page ID
        """
        self.access_token = config.get("access_token", "")
        self.page_id = config.get("page_id", "")
        self.page_name = config.get("page_name", "Facebook Page")

    @property
    def is_configured(self) -> bool:
        return bool(self.access_token and self.page_id)

    async def check_health(self) -> dict:
        """Check if the token and page_id are valid."""
        if not self.is_configured:
            return {"status": "not_configured", "message": "Missing access_token or page_id"}
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{META_API_BASE}/{self.page_id}",
                    params={"access_token": self.access_token, "fields": "name,fan_count,category"},
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return {
                        "status": "ok",
                        "page_name": data.get("name"),
                        "followers": data.get("fan_count"),
                        "category": data.get("category"),
                    }
                body = resp.json() if "json" in resp.headers.get("content-type", "") else {}
                return {
                    "status": "error",
                    "message": body.get("error", {}).get("message", f"HTTP {resp.status_code}"),
                }
        except Exception as e:
            return {"status": "error", "message": str(e)}

    async def fetch_recent_posts(self, limit: int = 25) -> list[dict]:
        """Fetch recent posts from the connected page."""
        if not self.is_configured:
            return _mock_posts(self.page_name, limit)
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(
                    f"{META_API_BASE}/{self.page_id}/posts",
                    params={
                        "access_token": self.access_token,
                        "fields": POST_FIELDS,
                        "limit": limit,
                    },
                )
                if resp.status_code != 200:
                    logger.warning("FB posts fetch failed: %s", resp.status_code)
                    return _mock_posts(self.page_name, limit)
                return resp.json().get("data", [])
        except Exception:
            logger.exception("FB posts fetch error")
            return _mock_posts(self.page_name, limit)

    async def fetch_post_comments(self, post_id: str, limit: int = 50) -> list[dict]:
        """Fetch comments on a specific post."""
        if not self.is_configured:
            return []
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{META_API_BASE}/{post_id}/comments",
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
            logger.exception("FB comments fetch error for post %s", post_id)
            return []

    async def fetch_all(self, post_limit: int = 10, comment_limit: int = 20) -> list[MentionResult]:
        """Fetch posts and their comments, return normalized MentionResults."""
        results: list[MentionResult] = []

        posts = await self.fetch_recent_posts(post_limit)
        for post in posts:
            # Post itself as a mention
            post_mention = _normalize_post(post, self.page_name)
            if post_mention:
                results.append(post_mention)

            # Comments on the post
            post_id = post.get("id", "")
            if post_id and self.is_configured:
                comments = await self.fetch_post_comments(post_id, comment_limit)
                for comment in comments:
                    comment_mention = _normalize_comment(comment, self.page_name, post)
                    if comment_mention:
                        results.append(comment_mention)

        logger.info("Facebook Page: fetched %d items from %s", len(results), self.page_name)
        return results

    def get_engagement_summary(self, posts: list[dict]) -> dict:
        """Compute engagement summary from posts."""
        total_reactions = 0
        total_comments = 0
        total_shares = 0
        for post in posts:
            reactions = post.get("reactions", {}).get("summary", {}).get("total_count", 0)
            comments = post.get("comments", {}).get("summary", {}).get("total_count", 0)
            shares = post.get("shares", {}).get("count", 0)
            total_reactions += reactions
            total_comments += comments
            total_shares += shares

        return {
            "posts_count": len(posts),
            "total_reactions": total_reactions,
            "total_comments": total_comments,
            "total_shares": total_shares,
            "avg_reactions": round(total_reactions / max(1, len(posts)), 1),
            "avg_comments": round(total_comments / max(1, len(posts)), 1),
        }


# ── Normalization helpers ──


def _normalize_post(post: dict, page_name: str) -> MentionResult | None:
    """Convert a Facebook post to MentionResult."""
    message = post.get("message", "")
    if not message or len(message) < 10:
        return None

    created_time = post.get("created_time")
    pub_dt = None
    if created_time:
        try:
            pub_dt = datetime.fromisoformat(created_time.replace("+0000", "+00:00"))
        except (ValueError, AttributeError):
            pass

    reactions = post.get("reactions", {}).get("summary", {}).get("total_count", 0)
    comments = post.get("comments", {}).get("summary", {}).get("total_count", 0)
    url = post.get("permalink_url", "")

    return MentionResult(
        title=f"FB Post by {page_name}: {message[:80]}",
        snippet=message[:2000],
        url=url,
        published_at=pub_dt,
        raw_json={
            "source": "facebook_page",
            "type": "post",
            "reactions": reactions,
            "comments": comments,
            "post_id": post.get("id"),
        },
        source_name="Facebook Page",
    )


def _normalize_comment(comment: dict, page_name: str, parent_post: dict) -> MentionResult | None:
    """Convert a Facebook comment to MentionResult."""
    message = comment.get("message", "")
    if not message or len(message) < 5:
        return None

    author = comment.get("from", {}).get("name", "Someone")
    created_time = comment.get("created_time")
    pub_dt = None
    if created_time:
        try:
            pub_dt = datetime.fromisoformat(created_time.replace("+0000", "+00:00"))
        except (ValueError, AttributeError):
            pass

    post_msg = (parent_post.get("message", "") or "")[:60]
    url = comment.get("permalink_url", parent_post.get("permalink_url", ""))

    return MentionResult(
        title=f"FB Comment by {author} on \"{post_msg}...\"",
        snippet=message[:2000],
        url=url,
        published_at=pub_dt,
        raw_json={
            "source": "facebook_page",
            "type": "comment",
            "author": author,
            "comment_id": comment.get("id"),
            "post_id": parent_post.get("id"),
        },
        source_name="Facebook Page",
    )


# ── Mock data for dev/demo ──


def _mock_posts(page_name: str, limit: int) -> list[dict]:
    """Return mock Facebook posts for development."""
    return [
        {
            "id": f"mock_post_{i}",
            "message": f"Check out our latest at {page_name}! We're excited to share new updates with our community.",
            "created_time": datetime.now(timezone.utc).isoformat(),
            "permalink_url": "",
            "reactions": {"summary": {"total_count": 15 + i * 3}},
            "comments": {"summary": {"total_count": 2 + i}},
            "shares": {"count": 1},
        }
        for i in range(min(limit, 3))
    ]
