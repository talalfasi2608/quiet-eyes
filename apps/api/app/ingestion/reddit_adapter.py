"""
Reddit adapter — searches Reddit for high-intent threads.

Uses Reddit's public JSON API (no OAuth needed for read-only search).
Falls back to Tavily search with site:reddit.com if the direct API fails.

High-intent patterns detected:
- "looking for", "recommend", "alternative to", "vs", "review", "complaint"
"""

import logging
from datetime import datetime, timezone

import httpx

from app.config import settings
from app.ingestion.adapters import MentionResult

logger = logging.getLogger(__name__)

REDDIT_SEARCH_URL = "https://www.reddit.com/search.json"

# Subreddits by vertical for targeted search
VERTICAL_SUBREDDITS: dict[str, list[str]] = {
    "restaurant": ["food", "FoodPorn", "restaurant", "Cooking", "Coffee"],
    "saas": ["SaaS", "startups", "Entrepreneur", "smallbusiness"],
    "ecommerce": ["ecommerce", "shopify", "smallbusiness", "Entrepreneur"],
    "real_estate": ["RealEstate", "realestateinvesting", "FirstTimeHomeBuyer"],
    "health_wellness": ["health", "fitness", "yoga", "Meditation"],
    "beauty_spa": ["SkincareAddiction", "beauty", "MakeupAddiction"],
    "marketing_agency": ["marketing", "digital_marketing", "SEO", "PPC"],
    "professional_services": ["smallbusiness", "Entrepreneur", "freelance"],
    "education": ["education", "college", "learnprogramming"],
    "financial_services": ["personalfinance", "FinancialPlanning", "investing"],
    "legal": ["legal", "legaladvice"],
}


async def _reddit_search(query: str, limit: int = 10) -> list[dict]:
    """Search Reddit public JSON API."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                REDDIT_SEARCH_URL,
                params={
                    "q": query,
                    "sort": "relevance",
                    "t": "month",
                    "limit": limit,
                    "type": "link",
                },
                headers={"User-Agent": "QuietEyes/1.0 (market intelligence)"},
            )
            if resp.status_code == 429:
                logger.warning("Reddit rate-limited, falling back to Tavily")
                return await _tavily_reddit_fallback(query, limit)
            if resp.status_code != 200:
                logger.warning("Reddit search failed: %s", resp.status_code)
                return await _tavily_reddit_fallback(query, limit)
            data = resp.json()
            return [child["data"] for child in data.get("data", {}).get("children", [])]
    except Exception:
        logger.exception("Reddit search error")
        return await _tavily_reddit_fallback(query, limit)


async def _tavily_reddit_fallback(query: str, limit: int) -> list[dict]:
    """Use Tavily to search Reddit when direct API is rate-limited."""
    if not settings.TAVILY_API_KEY:
        return []
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                "https://api.tavily.com/search",
                json={
                    "api_key": settings.TAVILY_API_KEY,
                    "query": f"site:reddit.com {query}",
                    "max_results": limit,
                    "include_answer": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            # Convert Tavily results to Reddit-like format
            return [
                {
                    "title": r.get("title", ""),
                    "selftext": r.get("content", ""),
                    "url": r.get("url", ""),
                    "permalink": r.get("url", ""),
                    "created_utc": 0,
                    "subreddit": "reddit",
                    "score": 0,
                    "num_comments": 0,
                    "_from_tavily": True,
                }
                for r in data.get("results", [])
            ]
    except Exception:
        logger.exception("Tavily Reddit fallback failed")
    return []


def _parse_post(post: dict) -> MentionResult:
    """Convert a Reddit post to MentionResult."""
    title = post.get("title", "")
    body = post.get("selftext", "") or ""
    subreddit = post.get("subreddit", "")
    url = post.get("url", "")
    permalink = post.get("permalink", "")

    if permalink and not permalink.startswith("http"):
        full_url = f"https://www.reddit.com{permalink}"
    else:
        full_url = url or permalink

    created_utc = post.get("created_utc", 0)
    pub_dt = None
    if created_utc:
        try:
            pub_dt = datetime.fromtimestamp(created_utc, tz=timezone.utc)
        except (ValueError, OSError):
            pass

    snippet = body[:500] if body else title
    source_label = f"r/{subreddit}" if subreddit else "Reddit"

    return MentionResult(
        title=f"[Reddit/{subreddit}] {title}"[:500],
        snippet=snippet[:2000],
        url=full_url[:2048],
        published_at=pub_dt,
        raw_json={
            "source": "reddit",
            "subreddit": subreddit,
            "score": post.get("score", 0),
            "num_comments": post.get("num_comments", 0),
        },
        source_name=source_label,
    )


def _build_reddit_queries(
    business_name: str,
    category: str | None,
    location: str | None,
    competitor_names: list[str],
    keywords: str | None = None,
) -> list[str]:
    """Build Reddit-optimized search queries."""
    queries: list[str] = []
    cat = (category or "").lower()

    # Business-specific queries
    queries.append(f'"{business_name}"')
    if location:
        queries.append(f"{business_name} {location}")

    # Competitor-related intent queries
    for comp in competitor_names[:3]:
        queries.append(f'"{comp}" alternative OR complaint OR issue OR problem')
        queries.append(f'"{comp}" vs OR "better than" OR "switch from"')

    # Category + intent queries
    if cat:
        intent_phrases = [
            f"best {cat} {location or ''}".strip(),
            f"looking for {cat} recommendation",
            f"{cat} complaint OR frustrated OR disappointed",
        ]
        queries.extend(intent_phrases)

    # Keyword queries
    if keywords:
        for kw in keywords.split(",")[:3]:
            kw = kw.strip()
            if kw:
                queries.append(f"{kw} recommendation OR review")

    return queries


async def fetch_reddit_mentions(
    business_name: str,
    category: str | None,
    location: str | None,
    competitor_names: list[str],
    keywords: str | None = None,
) -> list[MentionResult]:
    """
    Search Reddit for high-intent threads related to the business.
    Returns MentionResult list.
    """
    queries = _build_reddit_queries(
        business_name, category, location, competitor_names, keywords
    )

    results: list[MentionResult] = []
    seen_urls: set[str] = set()

    for query in queries:
        posts = await _reddit_search(query, limit=5)
        for post in posts:
            mention = _parse_post(post)
            if mention.url in seen_urls:
                continue
            seen_urls.add(mention.url)
            results.append(mention)

    logger.info("Reddit: fetched %d mentions from %d queries", len(results), len(queries))
    return results
