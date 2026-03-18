"""
Community Intent Engine — detects lead opportunities from posts, comments,
and community content using keyword, phrase, and context analysis.

Three-layer detection:
1. Generic intent phrases (universal buying/switching signals)
2. Vertical-specific phrases (per business category)
3. Context modifiers (urgency, location, competitor dissatisfaction)

Signal classes:
- HIGH_INTENT: active purchase/buy signals
- RECOMMENDATION_REQUEST: asking for suggestions
- SWITCHING_SIGNAL: dissatisfied with current provider
- COMPLAINT_OPPORTUNITY: competitor complaint = our opportunity
- LOCAL_DISCOVERY: looking for local business
- NOISE: irrelevant
"""

import re
from dataclasses import dataclass, field
from enum import Enum


class CommunitySignal(str, Enum):
    HIGH_INTENT = "HIGH_INTENT"
    RECOMMENDATION_REQUEST = "RECOMMENDATION_REQUEST"
    SWITCHING_SIGNAL = "SWITCHING_SIGNAL"
    COMPLAINT_OPPORTUNITY = "COMPLAINT_OPPORTUNITY"
    LOCAL_DISCOVERY = "LOCAL_DISCOVERY"
    NOISE = "NOISE"


@dataclass
class IntentResult:
    """Result of community intent analysis."""
    signal: CommunitySignal
    confidence: int  # 0-100
    urgency: int  # 0-100
    business_fit: int  # 0-100
    location_relevant: bool
    matched_phrases: list[str] = field(default_factory=list)
    reason: str = ""


# ═══════════════════════════════════════════════════════════════
# LAYER 1: Generic intent phrases (universal)
# ═══════════════════════════════════════════════════════════════

GENERIC_HIGH_INTENT = [
    (r"looking for\b", 85, "Actively searching"),
    (r"need (a|to find|to get)\b", 80, "Expressed need"),
    (r"want to (buy|get|try|order|book)\b", 90, "Ready to purchase"),
    (r"ready to (buy|switch|try|invest)\b", 95, "Buying intent"),
    (r"where (can|do|should) (i|we) (buy|get|find|book)\b", 85, "Seeking provider"),
    (r"who (sells|offers|provides|does)\b", 80, "Seeking provider"),
    (r"can anyone recommend\b", 90, "Direct recommendation request"),
    (r"does anyone know\b", 70, "Information seeking"),
    (r"urgent(ly)?\b.*(need|looking|help)", 95, "Urgent need"),
    (r"asap\b", 90, "Urgent"),
    (r"today\b.*(need|looking|find|get)", 85, "Same-day need"),
    (r"this week\b.*(need|looking|find)", 80, "Near-term need"),
]

GENERIC_RECOMMENDATION_REQUEST = [
    (r"recommend(ation)?s?\b", 80, "Asking for recommendation"),
    (r"suggest(ion)?s?\b", 75, "Asking for suggestions"),
    (r"anyone (know|tried|used|been to)\b", 70, "Seeking experience"),
    (r"what('s| is) the best\b", 85, "Seeking best option"),
    (r"top \d+ ", 60, "Comparing options"),
    (r"which .* (should|would|do you)\b", 70, "Comparing options"),
    (r"has anyone (tried|used|been|worked with)\b", 75, "Seeking validation"),
    (r"thoughts on\b", 60, "Seeking opinions"),
    (r"reviews? (of|for|on)\b", 65, "Seeking reviews"),
    (r"worth (it|trying|the money|the price)\b", 75, "Evaluating value"),
]

GENERIC_SWITCHING_SIGNAL = [
    (r"switch(ing|ed)? from\b", 90, "Actively switching"),
    (r"(moved?|moving) (away from|to)\b", 85, "Changing provider"),
    (r"alternative(s)? to\b", 85, "Seeking alternative"),
    (r"leaving\b.*\bfor\b", 80, "Switching in progress"),
    (r"(tired|sick|fed up) (of|with)\b", 80, "Dissatisfied"),
    (r"(cancel|cancell?ing|cancelled?) (my|our|the)\b", 90, "Canceling service"),
    (r"looking to (replace|change|swap)\b", 85, "Actively replacing"),
    (r"(better|cheaper) (option|alternative|choice)\b", 75, "Seeking improvement"),
    (r"\bvs\b", 65, "Comparing options"),
    (r"compared to\b", 65, "Comparing options"),
]

GENERIC_COMPLAINT_OPPORTUNITY = [
    (r"(terrible|horrible|awful|worst) (service|experience|food|quality)\b", 90, "Strong complaint"),
    (r"(not|never) (recommend|going back|again)\b", 85, "Rejecting provider"),
    (r"(rip.?off|scam|fraud|waste of money)\b", 90, "Fraud/price complaint"),
    (r"(disappointed|frustrat|disgust|angry)\b", 75, "Emotional complaint"),
    (r"(bad|poor|low) (quality|service|food|experience)\b", 70, "Quality complaint"),
    (r"(overpriced|too expensive|not worth)\b", 75, "Price complaint"),
    (r"(1|one|zero|0)\s*star", 85, "Minimum rating"),
    (r"don'?t (go|use|buy|try|bother)\b", 80, "Warning others"),
    (r"(refund|money back|charged me)\b", 85, "Transaction dispute"),
    (r"waited (for )?(\d+|forever|ages|too long)\b", 70, "Service delay complaint"),
]

GENERIC_LOCAL_DISCOVERY = [
    (r"\b(near|nearby|around|close to) (me|here|us)\b", 80, "Proximity search"),
    (r"\bin (my |the )?(area|neighborhood|town|city)\b", 75, "Local search"),
    (r"(best|good|great) .* (in|near|around) [A-Z]", 70, "Local quality search"),
    (r"(open|available) (now|today|tonight|this weekend)\b", 80, "Immediate local need"),
    (r"(delivery|deliver|ship) (to|in|near)\b", 65, "Delivery request"),
    (r"walk.?in\b", 70, "Walk-in intent"),
]


# ═══════════════════════════════════════════════════════════════
# LAYER 2: Vertical-specific phrases
# ═══════════════════════════════════════════════════════════════

VERTICAL_PHRASES: dict[str, list[tuple[str, int, str]]] = {
    "restaurant": [
        (r"(where|best place) to eat\b", 85, "Restaurant search"),
        (r"(good|best|nice) (restaurant|cafe|coffee|food|brunch|dinner)\b", 80, "Dining intent"),
        (r"(reservation|book a table|table for)\b", 90, "Booking intent"),
        (r"(takeout|take.?out|delivery|order food)\b", 80, "Order intent"),
        (r"(vegan|vegetarian|gluten.?free|kosher|halal) (option|menu|restaurant)\b", 75, "Dietary need"),
        (r"(happy hour|drink|cocktail|bar)\b.*\b(recommend|best|where)\b", 70, "Dining intent"),
        (r"(birthday|anniversary|date night|group dinner)\b", 75, "Occasion dining"),
        (r"(food poisoning|undercooked|cold food|wrong order)\b", 85, "Food complaint"),
        (r"(wait(ed)?|waiting) (time|too long|forever)\b", 70, "Service complaint"),
    ],
    "saas": [
        (r"(best|top|recommend) .*(software|tool|platform|app|saas)\b", 80, "SaaS search"),
        (r"(free trial|demo|pricing|plans)\b", 85, "Evaluation intent"),
        (r"(integrat|api|webhook|connect)\b.*\b(with|to)\b", 70, "Integration need"),
        (r"(onboard|implement|setup|migrate)\b", 70, "Implementation intent"),
        (r"(enterprise|team|business) (plan|pricing|license)\b", 80, "B2B intent"),
        (r"(bug|crash|downtime|slow|lag)\b", 75, "Technical complaint"),
    ],
    "real_estate": [
        (r"(looking for|need) .*(apartment|house|office|space|property)\b", 85, "Property search"),
        (r"(rent|buy|lease|move)\b.*\b(in|near|around)\b", 80, "Location-specific"),
        (r"(real estate|realtor|agent|broker)\b.*\b(recommend|best)\b", 85, "Agent search"),
        (r"(mortgage|financing|down payment)\b", 70, "Financial intent"),
    ],
    "health_wellness": [
        (r"(looking for|need|recommend) .*(doctor|therapist|trainer|coach|clinic)\b", 85, "Provider search"),
        (r"(appointment|consultation|session)\b", 80, "Booking intent"),
        (r"(pain|symptom|condition|treatment)\b.*\b(help|recommend|best)\b", 75, "Health concern"),
    ],
    "beauty_spa": [
        (r"(best|good|recommend) .*(salon|spa|stylist|barber|manicure|facial)\b", 85, "Service search"),
        (r"(appointment|booking|walk.?in)\b", 80, "Booking intent"),
        (r"(haircut|color|treatment|massage|facial)\b.*\b(near|in|recommend)\b", 75, "Service intent"),
    ],
    "professional_services": [
        (r"(looking for|need|recommend) .*(lawyer|accountant|consultant|designer|developer)\b", 85, "Service search"),
        (r"(quote|estimate|proposal|consultation)\b", 80, "Inquiry intent"),
        (r"(hire|outsource|contract|freelance)\b", 80, "Hiring intent"),
    ],
    "marketing_agency": [
        (r"(looking for|need|recommend) .*(agency|marketer|seo|ppc|social media)\b", 85, "Agency search"),
        (r"(marketing|advertising|branding|campaign)\b.*\b(help|agency|service)\b", 80, "Service search"),
        (r"(roi|results|performance|leads|conversions)\b.*\b(not|poor|bad|low)\b", 75, "Dissatisfaction"),
    ],
    "ecommerce": [
        (r"(where to buy|order online|shop for)\b", 85, "Purchase intent"),
        (r"(coupon|discount|promo|deal|sale)\b", 70, "Deal seeking"),
        (r"(shipping|delivery|return|refund)\b.*\b(issue|problem|slow)\b", 75, "Service complaint"),
    ],
}


# ═══════════════════════════════════════════════════════════════
# LAYER 3: Context modifiers
# ═══════════════════════════════════════════════════════════════

URGENCY_PATTERNS = [
    (r"\burgent(ly)?\b", 30),
    (r"\basap\b", 25),
    (r"\btoday\b", 20),
    (r"\btonigh?t\b", 20),
    (r"\bthis (week|weekend)\b", 15),
    (r"\bimmediately\b", 30),
    (r"\bright now\b", 25),
    (r"\bneed .* (fast|quick|soon)\b", 20),
    (r"\bemergency\b", 35),
    (r"\blast minute\b", 20),
    (r"\bhelp!?\b", 15),
]

LOCATION_PATTERNS = [
    r"\b(near|nearby|around|close to) (me|here|us)\b",
    r"\bin (my |the |our )?(area|neighborhood|town|city|block)\b",
    r"\b(deliver|delivery|ship) (to|in|near)\b",
    r"\b(tel aviv|jerusalem|haifa|new york|los angeles|london|berlin|paris)\b",  # common cities
]

DISSATISFACTION_INDICATORS = [
    r"\b(hate|dislike|disappointed|frustrated|angry|annoyed)\b",
    r"\b(terrible|horrible|awful|worst|trash|garbage)\b",
    r"\b(rip.?off|scam|overcharged|misleading)\b",
    r"\b(not worth|waste of|regret)\b",
    r"\b(never again|won't be back|done with)\b",
]

PURCHASING_LANGUAGE = [
    r"\b(buy|purchase|order|book|reserve|subscribe|sign up)\b",
    r"\b(pricing|price|cost|budget|quote|estimate)\b",
    r"\b(free trial|demo|sample|test)\b",
    r"\b(credit card|pay|payment|checkout)\b",
]


# ═══════════════════════════════════════════════════════════════
# MAIN ENGINE
# ═══════════════════════════════════════════════════════════════


def analyze_community_intent(
    text: str,
    source_type: str | None = None,
    source_name: str | None = None,
    business_category: str | None = None,
    business_location: str | None = None,
    business_keywords: str | None = None,
    competitor_names: list[str] | None = None,
    raw_json: dict | None = None,
) -> IntentResult:
    """
    Analyze a post/comment/caption for commercial intent.

    Returns an IntentResult with signal class, confidence, urgency,
    business fit, location relevance, matched phrases, and reasoning.
    """
    text_lower = text.lower()
    competitor_names = competitor_names or []
    raw = raw_json or {}

    # Track all matches
    matched: list[tuple[str, int, str]] = []  # (pattern_text, score, reason)

    # ── LAYER 1: Generic intent detection ──

    for pattern, score, reason in GENERIC_HIGH_INTENT:
        if re.search(pattern, text_lower):
            matched.append(("high_intent", score, reason))

    for pattern, score, reason in GENERIC_RECOMMENDATION_REQUEST:
        if re.search(pattern, text_lower):
            matched.append(("recommendation", score, reason))

    for pattern, score, reason in GENERIC_SWITCHING_SIGNAL:
        if re.search(pattern, text_lower):
            matched.append(("switching", score, reason))

    for pattern, score, reason in GENERIC_COMPLAINT_OPPORTUNITY:
        if re.search(pattern, text_lower):
            matched.append(("complaint", score, reason))

    for pattern, score, reason in GENERIC_LOCAL_DISCOVERY:
        if re.search(pattern, text_lower):
            matched.append(("local", score, reason))

    # ── LAYER 2: Vertical-specific ──

    category = (business_category or "").lower().replace(" ", "_")
    vertical_patterns = VERTICAL_PHRASES.get(category, [])
    for pattern, score, reason in vertical_patterns:
        if re.search(pattern, text_lower):
            matched.append(("vertical", score, reason))

    # ── LAYER 3: Context modifiers ──

    # Urgency
    urgency = 0
    for pattern, u_score in URGENCY_PATTERNS:
        if re.search(pattern, text_lower):
            urgency = max(urgency, u_score)

    # Location relevance
    location_relevant = False
    if business_location:
        loc_lower = business_location.lower()
        for loc_word in loc_lower.split(","):
            loc_word = loc_word.strip()
            if loc_word and loc_word in text_lower:
                location_relevant = True
                break
    for pattern in LOCATION_PATTERNS:
        if re.search(pattern, text_lower):
            location_relevant = True
            break

    # Competitor dissatisfaction
    competitor_mentioned = False
    for comp in competitor_names:
        if comp.lower() in text_lower:
            competitor_mentioned = True
            break

    has_dissatisfaction = any(
        re.search(p, text_lower) for p in DISSATISFACTION_INDICATORS
    )

    has_purchasing = any(
        re.search(p, text_lower) for p in PURCHASING_LANGUAGE
    )

    # Business fit: check if text relates to business keywords
    business_fit = 30  # baseline
    if business_keywords:
        for kw in business_keywords.split(","):
            kw = kw.strip().lower()
            if kw and kw in text_lower:
                business_fit = min(100, business_fit + 25)
    if category and category.replace("_", " ") in text_lower:
        business_fit = min(100, business_fit + 20)
    if location_relevant:
        business_fit = min(100, business_fit + 15)

    # Source-type boosts
    is_community = source_type in ("SOCIAL",) or (source_name or "").lower() in (
        "reddit", "facebook page", "instagram"
    )

    # ── SIGNAL CLASSIFICATION ──

    if not matched and not competitor_mentioned:
        return IntentResult(
            signal=CommunitySignal.NOISE,
            confidence=10,
            urgency=0,
            business_fit=business_fit,
            location_relevant=location_relevant,
            matched_phrases=[],
            reason="No intent signals detected",
        )

    # Score each signal class
    class_scores: dict[CommunitySignal, int] = {
        CommunitySignal.HIGH_INTENT: 0,
        CommunitySignal.RECOMMENDATION_REQUEST: 0,
        CommunitySignal.SWITCHING_SIGNAL: 0,
        CommunitySignal.COMPLAINT_OPPORTUNITY: 0,
        CommunitySignal.LOCAL_DISCOVERY: 0,
    }

    phrase_labels: list[str] = []

    for match_type, score, reason in matched:
        if match_type == "high_intent":
            class_scores[CommunitySignal.HIGH_INTENT] += score
            phrase_labels.append(reason)
        elif match_type == "recommendation":
            class_scores[CommunitySignal.RECOMMENDATION_REQUEST] += score
            phrase_labels.append(reason)
        elif match_type == "switching":
            class_scores[CommunitySignal.SWITCHING_SIGNAL] += score
            phrase_labels.append(reason)
        elif match_type == "complaint":
            class_scores[CommunitySignal.COMPLAINT_OPPORTUNITY] += score
            phrase_labels.append(reason)
        elif match_type == "local":
            class_scores[CommunitySignal.LOCAL_DISCOVERY] += score
            phrase_labels.append(reason)
        elif match_type == "vertical":
            # Vertical matches boost the most relevant class
            class_scores[CommunitySignal.HIGH_INTENT] += score // 2
            class_scores[CommunitySignal.RECOMMENDATION_REQUEST] += score // 2
            phrase_labels.append(reason)

    # Competitor dissatisfaction boosts
    if competitor_mentioned and has_dissatisfaction:
        class_scores[CommunitySignal.COMPLAINT_OPPORTUNITY] += 40
        class_scores[CommunitySignal.SWITCHING_SIGNAL] += 30
        phrase_labels.append("Competitor dissatisfaction detected")

    # Purchasing language boosts high_intent
    if has_purchasing:
        class_scores[CommunitySignal.HIGH_INTENT] += 20

    # Community source boost
    if is_community:
        for k in class_scores:
            if class_scores[k] > 0:
                class_scores[k] += 10

    # Location boosts local discovery
    if location_relevant:
        class_scores[CommunitySignal.LOCAL_DISCOVERY] += 20

    # Pick winner
    best_signal = max(class_scores, key=lambda k: class_scores[k])
    best_score = class_scores[best_signal]

    if best_score < 30:
        return IntentResult(
            signal=CommunitySignal.NOISE,
            confidence=best_score,
            urgency=urgency,
            business_fit=business_fit,
            location_relevant=location_relevant,
            matched_phrases=phrase_labels[:3],
            reason="Weak signals below threshold",
        )

    # Build confidence (0-100)
    confidence = min(100, best_score)

    # Build reason
    reasons = list(dict.fromkeys(phrase_labels))[:3]  # dedupe, keep order
    reason_text = "; ".join(reasons) if reasons else best_signal.value

    return IntentResult(
        signal=best_signal,
        confidence=confidence,
        urgency=urgency,
        business_fit=business_fit,
        location_relevant=location_relevant,
        matched_phrases=reasons,
        reason=reason_text,
    )
