"""
Source rules: maps a business profile to search queries and RSS feeds.
Intent keywords are appended to business queries to surface different types of mentions.
"""

INTENT_KEYWORDS = [
    "looking for",
    "recommend",
    "alternative to",
    "review",
    "vs",
    "best",
    "complaint",
    "problem with",
]

# Category-specific query templates. {name} and {location} are interpolated.
CATEGORY_TEMPLATES: dict[str, list[str]] = {
    "restaurant": [
        '"{name}" restaurant review',
        '"{name}" {location} food',
        "best restaurant {location}",
    ],
    "saas": [
        '"{name}" software review',
        '"{name}" alternative',
        '"{name}" vs',
    ],
    "ecommerce": [
        '"{name}" online store review',
        "buy from {name}",
        '"{name}" shipping experience',
    ],
}

DEFAULT_TEMPLATES = [
    '"{name}"',
    '"{name}" review',
    '"{name}" {location}',
]

# Seed RSS feeds by category — real, working feeds
CATEGORY_RSS_FEEDS: dict[str, list[dict[str, str]]] = {
    "_default": [
        {
            "name": "Hacker News",
            "url": "https://hnrss.org/newest?points=50",
        },
        {
            "name": "TechCrunch",
            "url": "https://techcrunch.com/feed/",
        },
    ],
    "restaurant": [
        {
            "name": "Eater",
            "url": "https://www.eater.com/rss/index.xml",
        },
        {
            "name": "Serious Eats",
            "url": "https://www.seriouseats.com/feeds/serious-eats",
        },
    ],
    "saas": [
        {
            "name": "Hacker News",
            "url": "https://hnrss.org/newest?points=50",
        },
        {
            "name": "Product Hunt",
            "url": "https://www.producthunt.com/feed",
        },
    ],
    "real_estate": [
        {
            "name": "Inman News",
            "url": "https://www.inman.com/feed/",
        },
    ],
    "health_wellness": [
        {
            "name": "MindBodyGreen",
            "url": "https://www.mindbodygreen.com/rss",
        },
    ],
    "marketing_agency": [
        {
            "name": "MarketingProfs",
            "url": "https://www.marketingprofs.com/rss/topic/all",
        },
        {
            "name": "Search Engine Journal",
            "url": "https://www.searchenginejournal.com/feed/",
        },
    ],
}


def build_queries_for_business(
    name: str,
    category: str | None,
    location: str | None,
    competitor_names: list[str],
    keywords: str | None = None,
) -> list[str]:
    """Build search queries for a business and its competitors."""
    templates = CATEGORY_TEMPLATES.get(
        (category or "").lower(), DEFAULT_TEMPLATES
    )
    location_str = location or ""

    queries: list[str] = []

    # Business queries from templates
    for tmpl in templates:
        q = tmpl.format(name=name, location=location_str).strip()
        if q:
            queries.append(q)

    # Intent-based queries for the business
    for kw in INTENT_KEYWORDS[:4]:
        queries.append(f"{name} {kw}")

    # Competitor queries
    for comp in competitor_names:
        queries.append(f'"{comp}" vs "{name}"')
        queries.append(f'"{comp}" review')

    # Keyword-based queries from onboarding metadata
    if keywords:
        for kw in keywords.split(","):
            kw = kw.strip()
            if kw:
                queries.append(f'"{name}" {kw}')
                if location_str:
                    queries.append(f"{kw} {location_str}")

    return queries


def get_rss_feeds_for_category(category: str | None) -> list[dict[str, str]]:
    """Return RSS feed URLs for a given category."""
    key = (category or "").lower()
    return CATEGORY_RSS_FEEDS.get(key, CATEGORY_RSS_FEEDS["_default"])
