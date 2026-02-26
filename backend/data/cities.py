"""
City configuration for multi-city support in Quiet Eyes.

Provides city-specific settings for SerpAPI location, search radius,
districts, Facebook groups, local news sources, and AI prompt context.
Resolved from the existing businesses.location field via pure-Python lookup.
"""

# =============================================================================
# CITY CONFIGURATIONS
# =============================================================================

ISRAELI_CITIES: dict[str, dict] = {
    "תל אביב": {
        "lat": 32.0853,
        "lng": 34.7818,
        "radius_km": 5,
        "population": 460000,
        "districts": [
            "צפון ת״א", "דרום ת״א",
            "מרכז ת״א", "יפו",
        ],
        "facebook_groups": [
            "tlv.residents",
            "tlv.food",
            "tlv.business",
        ],
        "local_news": [
            "tel-aviv-city.co.il",
            "tlv1.co.il",
        ],
        "serp_location": "Tel Aviv, Israel",
    },
    "ירושלים": {
        "lat": 31.7683,
        "lng": 35.2137,
        "radius_km": 6,
        "population": 970000,
        "districts": [
            "מרכז העיר", "רמות", "גילה",
            "פסגת זאב", "מלחה", "בקעה",
        ],
        "facebook_groups": [
            "jerusalem.residents",
            "jerusalem.business",
            "jerusalem.food",
        ],
        "local_news": [
            "kikar.co.il",
            "mynet.co.il/jerusalem",
        ],
        "serp_location": "Jerusalem, Israel",
        "special_notes": "שוק חרדי גדול, תיירות גבוהה",
    },
    "חיפה": {
        "lat": 32.7940,
        "lng": 34.9896,
        "radius_km": 5,
        "population": 290000,
        "districts": [
            "הדר", "כרמל", "נווה שאנן",
            "כרמליה", "קריית חיים",
        ],
        "facebook_groups": [
            "haifa.residents",
            "haifa.business",
        ],
        "local_news": [
            "haifa.mynet.co.il",
            "haifamagazine.com",
        ],
        "serp_location": "Haifa, Israel",
    },
    "באר שבע": {
        "lat": 31.2524,
        "lng": 34.7915,
        "radius_km": 6,
        "population": 210000,
        "districts": [
            "מרכז", "נווה זאב", "רמות",
            "נאות לון",
        ],
        "facebook_groups": [
            "beersheba.residents",
            "beersheba.business",
        ],
        "local_news": [
            "inn.co.il/beersheva",
        ],
        "serp_location": "Beer Sheva, Israel",
        "special_notes": "קהל סטודנטים גדול, BGU",
    },
    "נתניה": {
        "lat": 32.3226,
        "lng": 34.8533,
        "radius_km": 4,
        "population": 230000,
        "districts": [],
        "facebook_groups": [],
        "local_news": [],
        "serp_location": "Netanya, Israel",
    },
    "אשדוד": {
        "lat": 31.8014,
        "lng": 34.6552,
        "radius_km": 4,
        "population": 240000,
        "districts": [],
        "facebook_groups": [],
        "local_news": [],
        "serp_location": "Ashdod, Israel",
    },
    "ראשון לציון": {
        "lat": 31.9730,
        "lng": 34.7925,
        "radius_km": 4,
        "population": 260000,
        "districts": [],
        "facebook_groups": [],
        "local_news": [],
        "serp_location": "Rishon LeZion, Israel",
    },
    "פתח תקווה": {
        "lat": 32.0840,
        "lng": 34.8878,
        "radius_km": 4,
        "population": 250000,
        "districts": [],
        "facebook_groups": [],
        "local_news": [],
        "serp_location": "Petah Tikva, Israel",
    },
}

# =============================================================================
# CITY ALIASES — maps English/alternative names to canonical Hebrew keys
# =============================================================================

CITY_ALIASES: dict[str, str] = {
    # Tel Aviv
    "tel aviv": "תל אביב",
    "tel-aviv": "תל אביב",
    "tlv": "תל אביב",
    "תל-אביב": "תל אביב",
    "תל אביב יפו": "תל אביב",
    "תל אביב-יפו": "תל אביב",
    "gush dan": "תל אביב",
    "גוש דן": "תל אביב",
    # Jerusalem
    "jerusalem": "ירושלים",
    "j-m": "ירושלים",
    # Haifa
    "haifa": "חיפה",
    # Beer Sheva
    "beer sheva": "באר שבע",
    "beersheva": "באר שבע",
    "beersheba": "באר שבע",
    "beer-sheva": "באר שבע",
    "be'er sheva": "באר שבע",
    "באר-שבע": "באר שבע",
    # Netanya
    "netanya": "נתניה",
    # Ashdod
    "ashdod": "אשדוד",
    # Rishon LeZion
    "rishon lezion": "ראשון לציון",
    "rishon le zion": "ראשון לציון",
    "rishon": "ראשון לציון",
    "ראשל״צ": "ראשון לציון",
    "ראשל\"צ": "ראשון לציון",
    # Petah Tikva
    "petah tikva": "פתח תקווה",
    "petach tikva": "פתח תקווה",
    "petah-tikva": "פתח תקווה",
    "פ״ת": "פתח תקווה",
    "פ\"ת": "פתח תקווה",
    "פתח-תקווה": "פתח תקווה",
}

# =============================================================================
# CITY CONTEXT — Hebrew demographic/cultural context for Claude prompts
# =============================================================================

CITY_CONTEXT: dict[str, str] = {
    "תל אביב": (
        "תל אביב היא העיר הגדולה והתוססת ביותר בישראל עם:\n"
        "- אוכלוסייה צעירה, חילונית ברובה, מגוונת\n"
        "- מרכז הייטק, סטארטאפים ועסקים קטנים\n"
        "- תרבות בילויים ואוכל עשירה, חיי לילה\n"
        "- עסקים פתוחים בשבת, קהל תיירים\n"
        "- ביקוש גבוה לאיכות חיים, טרנדים וחדשנות"
    ),
    "ירושלים": (
        "ירושלים היא עיר מגוונת עם:\n"
        "- אוכלוסייה חרדית גדולה (שומרת שבת/כשרות)\n"
        "- תיירות בינלאומית גבוהה\n"
        "- קהל ממשלתי ואקדמי\n"
        "- עסקים סגורים בשבת חובה\n"
        "- ביקוש עונתי גבוה בחגים יהודיים"
    ),
    "חיפה": (
        "חיפה היא עיר מעורבת עם:\n"
        "- אוכלוסייה ערבית משמעותית (כ-20%)\n"
        "- תעשייה כבדה, נמל, טכניון\n"
        "- דו-קיום יהודי-ערבי, חג החגים\n"
        "- אוכלוסייה מבוגרת יחסית\n"
        "- שכונות מגוונות מהדר עד כרמל"
    ),
    "באר שבע": (
        "באר שבע היא בירת הנגב עם:\n"
        "- קהל סטודנטים גדול (אוניברסיטת בן-גוריון)\n"
        "- אוכלוסייה בדואית משמעותית\n"
        "- עסקים מוזלים יחסית, מחירים נמוכים\n"
        "- פיתוח מואץ של פארקי הייטק\n"
        "- ביקוש לשירותים בסיסיים ונגישים"
    ),
    "נתניה": (
        "נתניה היא עיר חוף עם:\n"
        "- אוכלוסייה מגוונת, עולים חדשים רבים (צרפת, רוסיה)\n"
        "- תיירות חוף וקו מלונות\n"
        "- אוכלוסייה מבוגרת משמעותית\n"
        "- ביקוש לשירותי פנאי ובריאות"
    ),
    "אשדוד": (
        "אשדוד היא עיר נמל עם:\n"
        "- אוכלוסייה צעירה וצומחת\n"
        "- קהילה דתית-לאומית חזקה\n"
        "- נמל תעשייתי גדול\n"
        "- ביקוש למסחר קמעונאי ושירותים"
    ),
    "ראשון לציון": (
        "ראשון לציון היא עיר לוויין של גוש דן עם:\n"
        "- אוכלוסייה משפחתית, מעמד בינוני-גבוה\n"
        "- אזורי תעשייה ומסחר גדולים\n"
        "- קרבה לתל אביב, תחרות על קהלים\n"
        "- ביקוש לשירותים משפחתיים ופנאי"
    ),
    "פתח תקווה": (
        "פתח תקווה היא עיר ותיקה במרכז עם:\n"
        "- אוכלוסייה מעורבת חילונית-דתית\n"
        "- מרכז רפואי גדול (בילינסון)\n"
        "- אזורי תעשייה ומסחר\n"
        "- ביקוש לשירותי בריאות ומסחר קמעונאי"
    ),
}

# =============================================================================
# DEFAULT FALLBACK
# =============================================================================

DEFAULT_CITY_CONFIG: dict = {
    "lat": None,
    "lng": None,
    "radius_km": 3,
    "population": 0,
    "districts": [],
    "facebook_groups": [],
    "local_news": [],
    "serp_location": "Israel",
}

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def get_city_config(location: str) -> dict:
    """
    Resolve city configuration from a location string.

    3-level match: exact Hebrew key -> alias lookup -> partial substring -> fallback.
    """
    if not location:
        return {**DEFAULT_CITY_CONFIG}

    loc = location.strip()

    # Level 1: exact match on Hebrew key
    if loc in ISRAELI_CITIES:
        return ISRAELI_CITIES[loc]

    # Level 2: alias lookup (case-insensitive)
    loc_lower = loc.lower()
    canonical = CITY_ALIASES.get(loc_lower)
    if canonical and canonical in ISRAELI_CITIES:
        return ISRAELI_CITIES[canonical]

    # Level 3: partial substring match
    for city_key, config in ISRAELI_CITIES.items():
        if city_key in loc or loc in city_key:
            return config

    # Also check aliases as substrings
    for alias, canonical in CITY_ALIASES.items():
        if alias in loc_lower or loc_lower in alias:
            if canonical in ISRAELI_CITIES:
                return ISRAELI_CITIES[canonical]

    # Fallback with location-specific serp_location
    return {**DEFAULT_CITY_CONFIG, "serp_location": f"{loc}, Israel"}


def get_city_context(location: str) -> str:
    """
    Get Hebrew demographic/cultural context text for Claude prompts.
    Returns empty string if no context available for the city.
    """
    if not location:
        return ""

    loc = location.strip()

    # Direct match
    if loc in CITY_CONTEXT:
        return CITY_CONTEXT[loc]

    # Alias match
    loc_lower = loc.lower()
    canonical = CITY_ALIASES.get(loc_lower)
    if canonical and canonical in CITY_CONTEXT:
        return CITY_CONTEXT[canonical]

    # Partial match
    for city_key, context in CITY_CONTEXT.items():
        if city_key in loc or loc in city_key:
            return context

    return ""


def get_serp_location(location: str) -> str:
    """Get SerpAPI location parameter for a city."""
    config = get_city_config(location)
    return config.get("serp_location", "Israel")


def get_districts(location: str) -> list[str]:
    """Get district names for a city."""
    config = get_city_config(location)
    return config.get("districts", [])
