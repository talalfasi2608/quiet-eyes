"""
Collector adapters for fetching mention data from external sources.
"""

import logging
from datetime import datetime, timezone

import feedparser
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


# ── Result shape returned by all adapters ──

class MentionResult:
    __slots__ = ("title", "snippet", "url", "published_at", "raw_json", "source_name")

    def __init__(
        self,
        title: str,
        snippet: str,
        url: str,
        published_at: datetime | None,
        raw_json: dict | None = None,
        source_name: str = "",
    ):
        self.title = title
        self.snippet = snippet
        self.url = url
        self.published_at = published_at
        self.raw_json = raw_json
        self.source_name = source_name


# ── Mock / fixture results for dev without TAVILY_API_KEY ──

MOCK_RESULTS: list[dict] = [
    {
        "title": "Why small businesses are turning to AI for lead generation",
        "snippet": "A new wave of AI tools helps SMBs find and qualify leads automatically from web mentions and social signals.",
        "url": "https://example.com/articles/ai-lead-gen-smb",
    },
    {
        "title": "Top 10 market intelligence platforms in 2026",
        "snippet": "We reviewed the best platforms for competitive intelligence, brand monitoring, and market research.",
        "url": "https://example.com/articles/top-market-intel-2026",
    },
    {
        "title": "How to monitor brand mentions across the web",
        "snippet": "Brand monitoring is essential for reputation management. Here are strategies and tools to track every mention.",
        "url": "https://example.com/articles/brand-mention-monitoring",
    },
    {
        "title": "Reddit thread: Looking for alternatives to legacy CRM tools",
        "snippet": "Users discuss lightweight CRM alternatives that integrate with social listening and mention tracking.",
        "url": "https://example.com/reddit/crm-alternatives",
    },
    {
        "title": "Review: Best competitive analysis tools for startups",
        "snippet": "Startups need affordable yet powerful competitive analysis. We tested 8 tools head-to-head.",
        "url": "https://example.com/articles/competitive-analysis-startups",
    },
    {
        "title": "Customer complaints surge for legacy providers",
        "snippet": "Forum posts reveal growing frustration with slow support and outdated interfaces from incumbent providers.",
        "url": "https://example.com/forums/legacy-complaints",
    },
    {
        "title": "Industry report: Digital marketing spend shifts to AI-first tools",
        "snippet": "Marketing budgets are increasingly allocated to AI-powered tools that automate outreach and content creation.",
        "url": "https://example.com/reports/ai-marketing-spend",
    },
    {
        "title": "Comparison: Mention tracking vs social listening platforms",
        "snippet": "Understanding the difference between mention tracking and social listening can help you choose the right tool.",
        "url": "https://example.com/articles/mention-vs-social",
    },
    {
        "title": "New study: 73% of B2B buyers research online before contacting sales",
        "snippet": "Capturing intent signals from online research behavior is becoming critical for B2B sales teams.",
        "url": "https://example.com/studies/b2b-buyer-research",
    },
    {
        "title": "How local businesses win with online reputation management",
        "snippet": "Local businesses that actively manage reviews and mentions see 35% higher foot traffic on average.",
        "url": "https://example.com/articles/local-reputation",
    },
    {
        "title": "5 signs your competitor is outpacing you online",
        "snippet": "Monitoring competitor mentions can reveal gaps in your own strategy. Here are the warning signs.",
        "url": "https://example.com/articles/competitor-signals",
    },
    {
        "title": "Forum discussion: Best tools for tracking industry mentions",
        "snippet": "Community members share their favorite tools for staying on top of industry news and brand mentions.",
        "url": "https://example.com/forums/mention-tools",
    },
]


# ── Search Adapter ──


class SearchAdapter:
    """
    Fetches search results. Uses Tavily API if key is set, otherwise returns mock fixtures.
    Mock results are personalized per query to ensure variety and dedup works.
    """

    async def search(self, query: str, max_results: int = 5) -> list[MentionResult]:
        if settings.TAVILY_API_KEY:
            return await self._tavily_search(query, max_results)
        return self._mock_search(query, max_results)

    async def _tavily_search(self, query: str, max_results: int) -> list[MentionResult]:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.post(
                    "https://api.tavily.com/search",
                    json={
                        "api_key": settings.TAVILY_API_KEY,
                        "query": query,
                        "max_results": max_results,
                        "include_answer": False,
                    },
                )
                resp.raise_for_status()
                data = resp.json()

            results = []
            for r in data.get("results", []):
                results.append(
                    MentionResult(
                        title=r.get("title", ""),
                        snippet=r.get("content", "")[:500],
                        url=r.get("url", ""),
                        published_at=None,
                        raw_json=r,
                        source_name="Tavily Search",
                    )
                )
            return results
        except Exception:
            logger.exception("Tavily search failed for query: %s", query)
            return []

    def _mock_search(self, query: str, max_results: int) -> list[MentionResult]:
        # Use hash of query to pick a deterministic but varied subset
        h = hash(query)
        start = abs(h) % len(MOCK_RESULTS)
        selected = []
        for i in range(max_results):
            idx = (start + i) % len(MOCK_RESULTS)
            m = MOCK_RESULTS[idx]
            selected.append(
                MentionResult(
                    title=m["title"],
                    snippet=f"[{query}] {m['snippet']}",
                    url=f"{m['url']}?q={query.replace(' ', '+')[:40]}",
                    published_at=datetime.now(timezone.utc),
                    raw_json={"mock": True, "query": query, **m},
                    source_name="Mock Search",
                )
            )
        return selected


# ── RSS Adapter ──


class RSSAdapter:
    """Fetches and parses RSS feeds."""

    async def fetch(self, feed_url: str, feed_name: str = "", max_items: int = 10) -> list[MentionResult]:
        try:
            async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
                resp = await client.get(feed_url)
                resp.raise_for_status()
                content = resp.text
        except Exception:
            logger.exception("RSS fetch failed for %s", feed_url)
            return []

        feed = feedparser.parse(content)
        results = []
        for entry in feed.entries[:max_items]:
            pub = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                try:
                    pub = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc)
                except Exception:
                    pass

            results.append(
                MentionResult(
                    title=entry.get("title", ""),
                    snippet=(entry.get("summary", "") or "")[:500],
                    url=entry.get("link", ""),
                    published_at=pub,
                    raw_json={
                        "feed_url": feed_url,
                        "title": entry.get("title", ""),
                        "link": entry.get("link", ""),
                    },
                    source_name=feed_name or feed_url,
                )
            )
        return results
