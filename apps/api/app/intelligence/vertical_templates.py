"""
Seed vertical templates for different business types.
Each template provides recommended configuration for a specific industry.
"""

VERTICAL_TEMPLATES: dict[str, dict] = {
    "local_services": {
        "slug": "local_services",
        "name": "Local Services",
        "description": "Plumbers, electricians, HVAC, cleaning, landscaping, and other local service providers",
        "source_rules": [
            "Google Maps reviews",
            "Yelp listings",
            "Nextdoor mentions",
            "Local directory sites",
            "Google Search: '{business} near me'",
        ],
        "keywords": [
            "{category} near me",
            "best {category} in {location}",
            "{category} reviews",
            "affordable {category}",
            "emergency {category}",
            "{category} cost",
        ],
        "trend_keywords": [
            "home improvement",
            "home repair",
            "emergency service",
            "seasonal maintenance",
            "renovation",
        ],
        "audience_hints": {
            "intents": ["PURCHASE", "COMPARISON", "QUESTION"],
            "min_score": 40,
            "geo_focus": True,
        },
        "campaign_tone": "trustworthy, local, responsive — emphasize speed, reliability, and local presence",
    },
    "beauty_clinics": {
        "slug": "beauty_clinics",
        "name": "Beauty Clinics",
        "description": "Dermatology, aesthetics, spas, salons, and wellness clinics",
        "source_rules": [
            "Instagram mentions and hashtags",
            "Google Reviews",
            "RealSelf reviews",
            "Facebook group mentions",
            "Google Search: '{treatment} clinic {location}'",
        ],
        "keywords": [
            "{category} clinic {location}",
            "best {category} near me",
            "{treatment} before after",
            "{treatment} cost",
            "{treatment} reviews",
            "{category} deals",
        ],
        "trend_keywords": [
            "aesthetic trends",
            "skincare routine",
            "anti-aging",
            "beauty treatment",
            "wellness trend",
        ],
        "audience_hints": {
            "intents": ["PURCHASE", "COMPARISON", "RECOMMENDATION"],
            "min_score": 50,
            "geo_focus": True,
        },
        "campaign_tone": "aspirational, results-driven, warm — showcase transformations and social proof",
    },
    "real_estate": {
        "slug": "real_estate",
        "name": "Real Estate",
        "description": "Real estate agents, brokerages, property managers, and developers",
        "source_rules": [
            "Zillow/Realtor.com activity",
            "Local news mentions",
            "Reddit r/realestate",
            "Google Reviews",
            "Google Search: 'homes for sale {location}'",
        ],
        "keywords": [
            "homes for sale {location}",
            "real estate agent {location}",
            "best realtor {location}",
            "property prices {location}",
            "moving to {location}",
            "investment property {location}",
        ],
        "trend_keywords": [
            "housing market",
            "interest rates",
            "property values",
            "neighborhood development",
            "first time buyer",
        ],
        "audience_hints": {
            "intents": ["PURCHASE", "COMPARISON", "QUESTION"],
            "min_score": 60,
            "geo_focus": True,
        },
        "campaign_tone": "professional, data-driven, reassuring — emphasize expertise, market knowledge, and client success",
    },
    "ecommerce": {
        "slug": "ecommerce",
        "name": "E-Commerce",
        "description": "Online stores, DTC brands, and marketplace sellers",
        "source_rules": [
            "Product review sites",
            "Reddit product mentions",
            "Social media brand mentions",
            "Competitor pricing monitors",
            "Google Search: '{product} review'",
        ],
        "keywords": [
            "best {product}",
            "{product} review",
            "{product} vs {competitor}",
            "{product} discount",
            "{brand} coupon",
            "where to buy {product}",
        ],
        "trend_keywords": [
            "product launch",
            "sale event",
            "seasonal shopping",
            "customer reviews",
            "brand comparison",
        ],
        "audience_hints": {
            "intents": ["PURCHASE", "COMPARISON", "RECOMMENDATION"],
            "min_score": 45,
            "geo_focus": False,
        },
        "campaign_tone": "conversion-focused, social proof heavy — emphasize reviews, deals, and urgency",
    },
    "restaurants": {
        "slug": "restaurants",
        "name": "Restaurants & Food",
        "description": "Restaurants, cafes, food trucks, catering, and food delivery",
        "source_rules": [
            "Google Maps reviews",
            "Yelp reviews",
            "TripAdvisor",
            "Instagram food hashtags",
            "Google Search: 'best {cuisine} {location}'",
        ],
        "keywords": [
            "best {cuisine} {location}",
            "restaurants near me",
            "{cuisine} delivery {location}",
            "food reviews {location}",
            "new restaurants {location}",
        ],
        "trend_keywords": [
            "food trends",
            "new restaurant",
            "menu update",
            "food delivery",
            "dining experience",
        ],
        "audience_hints": {
            "intents": ["PURCHASE", "RECOMMENDATION", "QUESTION"],
            "min_score": 35,
            "geo_focus": True,
        },
        "campaign_tone": "appetizing, inviting, local — emphasize food quality, ambiance, and community",
    },
}


def get_template(slug: str) -> dict | None:
    return VERTICAL_TEMPLATES.get(slug)


def list_templates() -> list[dict]:
    return list(VERTICAL_TEMPLATES.values())
