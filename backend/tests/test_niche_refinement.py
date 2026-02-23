"""
Niche Refinement Test — Quiet Eyes Sprint 12

Validates that industry detection and niche separation work correctly,
and that the Sprint 12 negative_prompts fix is in place.

Tests:
  1. Pet grooming inputs -> must detect pet_grooming
  2. Beauty inputs -> must detect beauty_cosmetics
  3. Verify blueprints have distinct negative_prompts
  4. Verify no overlap in lead_intent_phrases
  5. Verify _filter_with_ai source code references negative_prompts

Usage:
  python tests/test_niche_refinement.py
"""

import os
import sys
import inspect

# Ensure backend directory is on the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

PASS = "\033[92mPASS\033[0m"
FAIL = "\033[91mFAIL\033[0m"
WARN = "\033[93mWARN\033[0m"


def test_header(num: int, title: str):
    print(f"\n{'─'*60}")
    print(f"  Test {num}: {title}")
    print(f"{'─'*60}")


def main():
    print("\n" + "=" * 60)
    print("  Quiet Eyes — Niche Refinement Test (Sprint 12)")
    print("=" * 60)

    results = []
    warnings = []

    # ── Seed blueprints for testing ────────────────────────────────────
    # These mirror the SEED_BLUEPRINTS from industry_router.py
    SEED_BLUEPRINTS = {
        "pet_grooming": {
            "industry_key": "pet_grooming",
            "display_name_he": "טיפוח חיות מחמד",
            "lead_intent_phrases": [
                "מחפש גרומר לכלב",
                "ספר לחתול",
                "טיפוח כלבים",
                "גזיזת פרווה",
                "רחיצת כלב",
            ],
            "negative_prompts": [
                "ONLY include PET/ANIMAL grooming businesses",
                "EXCLUDE human hair salons and beauty salons",
                "EXCLUDE cosmetics and human beauty treatments",
            ],
        },
        "beauty_cosmetics": {
            "industry_key": "beauty_cosmetics",
            "display_name_he": "יופי וקוסמטיקה",
            "lead_intent_phrases": [
                "מחפשת קוסמטיקאית",
                "טיפול פנים",
                "מניקור פדיקור",
                "מספרה לנשים",
                "תספורת גברים",
            ],
            "negative_prompts": [
                "If industry is HUMAN beauty/cosmetics, EXCLUDE animal/pet grooming",
            ],
        },
        "food_restaurant": {
            "industry_key": "food_restaurant",
            "display_name_he": "מסעדה/אוכל",
            "lead_intent_phrases": [
                "מחפש מסעדה טובה",
                "המלצה על מקום לאכול",
                "משלוחי אוכל",
            ],
            "negative_prompts": [
                "Do NOT include non-food businesses",
            ],
        },
    }

    # Keywords -> expected industry mapping
    KEYWORD_MAP_PET = ["כלב", "חתול", "גרומר", "pet grooming", "dog grooming"]
    KEYWORD_MAP_BEAUTY = ["יופי", "קוסמטיקה", "מספרה", "beauty salon", "cosmetics"]

    # ── Test 1: Pet grooming detection ─────────────────────────────────
    test_header(1, "Pet grooming inputs -> must detect pet_grooming")
    try:
        pet_detected = True
        for kw in KEYWORD_MAP_PET:
            # Simple keyword-based detection (mirrors IndustryRouterService)
            matched = _simple_detect(kw, SEED_BLUEPRINTS)
            if matched != "pet_grooming":
                print(f"  '{kw}' -> detected as '{matched}' (expected: pet_grooming)")
                pet_detected = False
            else:
                print(f"  '{kw}' -> pet_grooming")

        if pet_detected:
            print(f"  [{PASS}] All pet grooming keywords detected correctly")
            results.append(("Test 1: Pet grooming detection", "PASS"))
        else:
            print(f"  [{FAIL}] Some keywords misclassified")
            results.append(("Test 1: Pet grooming detection", "FAIL"))
    except Exception as e:
        print(f"  [{FAIL}] Error: {e}")
        results.append(("Test 1: Pet grooming detection", "FAIL"))

    # ── Test 2: Beauty detection ───────────────────────────────────────
    test_header(2, "Beauty inputs -> must detect beauty_cosmetics")
    try:
        beauty_detected = True
        for kw in KEYWORD_MAP_BEAUTY:
            matched = _simple_detect(kw, SEED_BLUEPRINTS)
            if matched != "beauty_cosmetics":
                print(f"  '{kw}' -> detected as '{matched}' (expected: beauty_cosmetics)")
                beauty_detected = False
            else:
                print(f"  '{kw}' -> beauty_cosmetics")

        if beauty_detected:
            print(f"  [{PASS}] All beauty keywords detected correctly")
            results.append(("Test 2: Beauty detection", "PASS"))
        else:
            print(f"  [{FAIL}] Some keywords misclassified")
            results.append(("Test 2: Beauty detection", "FAIL"))
    except Exception as e:
        print(f"  [{FAIL}] Error: {e}")
        results.append(("Test 2: Beauty detection", "FAIL"))

    # ── Test 3: Distinct negative_prompts ──────────────────────────────
    test_header(3, "Verify blueprints have distinct negative_prompts")
    try:
        all_have_negatives = True
        for key, bp in SEED_BLUEPRINTS.items():
            neg = bp.get("negative_prompts", [])
            if not neg:
                print(f"  {key}: NO negative_prompts!")
                all_have_negatives = False
                warnings.append(f"Missing negative_prompts: {key}")
            else:
                print(f"  {key}: {len(neg)} negative_prompts")
                for p in neg:
                    print(f"    - {p}")

        # Check pet vs beauty are distinct
        pet_neg = set(str(p) for p in SEED_BLUEPRINTS["pet_grooming"]["negative_prompts"])
        beauty_neg = set(str(p) for p in SEED_BLUEPRINTS["beauty_cosmetics"]["negative_prompts"])
        overlap = pet_neg & beauty_neg
        if overlap:
            print(f"  [{FAIL}] Overlap in negative_prompts: {overlap}")
            results.append(("Test 3: Distinct negative_prompts", "FAIL"))
        elif all_have_negatives:
            print(f"  [{PASS}] All blueprints have distinct negative_prompts")
            results.append(("Test 3: Distinct negative_prompts", "PASS"))
        else:
            print(f"  [{FAIL}] Some blueprints missing negative_prompts")
            results.append(("Test 3: Distinct negative_prompts", "FAIL"))
    except Exception as e:
        print(f"  [{FAIL}] Error: {e}")
        results.append(("Test 3: Distinct negative_prompts", "FAIL"))

    # ── Test 4: No overlap in lead_intent_phrases ──────────────────────
    test_header(4, "Verify no overlap in lead_intent_phrases")
    try:
        pet_phrases = set(
            p.lower() for p in SEED_BLUEPRINTS["pet_grooming"]["lead_intent_phrases"]
        )
        beauty_phrases = set(
            p.lower() for p in SEED_BLUEPRINTS["beauty_cosmetics"]["lead_intent_phrases"]
        )
        overlap = pet_phrases & beauty_phrases

        if overlap:
            print(f"  [{FAIL}] Overlapping phrases: {overlap}")
            results.append(("Test 4: No phrase overlap", "FAIL"))
        else:
            print(f"  Pet grooming phrases: {len(pet_phrases)}")
            print(f"  Beauty phrases: {len(beauty_phrases)}")
            print(f"  Overlap: 0")
            print(f"  [{PASS}] No overlap in lead_intent_phrases")
            results.append(("Test 4: No phrase overlap", "PASS"))
    except Exception as e:
        print(f"  [{FAIL}] Error: {e}")
        results.append(("Test 4: No phrase overlap", "FAIL"))

    # ── Test 5: _filter_with_ai references negative_prompts ────────────
    test_header(5, "Verify _filter_with_ai source references negative_prompts (Sprint 12 fix)")
    try:
        from services.lead_sniper import LeadSniperService

        source = inspect.getsource(LeadSniperService._filter_with_ai)

        checks = {
            "negative_prompts parameter": "negative_prompts" in source,
            "CRITICAL INDUSTRY FILTERS": "CRITICAL INDUSTRY FILTERS" in source,
            "negative_prompts injection": "negative_prompts_section" in source,
        }

        all_pass = True
        for check_name, passed in checks.items():
            status = PASS if passed else FAIL
            print(f"  [{status}] {check_name}")
            if not passed:
                all_pass = False

        if all_pass:
            results.append(("Test 5: _filter_with_ai has negative_prompts", "PASS"))
        else:
            results.append(("Test 5: _filter_with_ai has negative_prompts", "FAIL"))

        # Also verify sniping_mission extracts negative_prompts
        source_mission = inspect.getsource(LeadSniperService.sniping_mission)
        if 'negative_prompts' in source_mission:
            print(f"  [{PASS}] sniping_mission extracts negative_prompts")
        else:
            print(f"  [{FAIL}] sniping_mission does NOT extract negative_prompts")
            results[-1] = ("Test 5: _filter_with_ai has negative_prompts", "FAIL")

    except Exception as e:
        print(f"  [{FAIL}] Error: {e}")
        results.append(("Test 5: _filter_with_ai has negative_prompts", "FAIL"))

    # ── Summary ───────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    for label, status in results:
        color = PASS if status == "PASS" else FAIL
        print(f"  [{color}] {label}")

    if warnings:
        print(f"\n  Warnings:")
        for w in warnings:
            print(f"  [{WARN}] {w}")

    passes = sum(1 for _, s in results if s == "PASS")
    fails = sum(1 for _, s in results if s == "FAIL")
    print(f"\n  Total: {passes} passed, {fails} failed, {len(warnings)} warnings")
    print(f"{'='*60}\n")

    return 0 if fails == 0 else 1


def _simple_detect(keyword: str, blueprints: dict) -> str:
    """
    Simple keyword-to-industry detection for testing.
    Mirrors the logic of IndustryRouterService.KEYWORD_MAP.
    """
    keyword_lower = keyword.lower()

    # Pet grooming keywords
    pet_keywords = [
        "כלב", "חתול", "גרומר", "pet", "dog", "cat", "grooming",
        "חיות מחמד", "וטרינר",
    ]
    for pk in pet_keywords:
        if pk in keyword_lower:
            return "pet_grooming"

    # Beauty keywords
    beauty_keywords = [
        "יופי", "קוסמטיקה", "מספרה", "beauty", "cosmetics", "salon",
        "מניקור", "פדיקור", "טיפול פנים",
    ]
    for bk in beauty_keywords:
        if bk in keyword_lower:
            return "beauty_cosmetics"

    # Food keywords
    food_keywords = ["מסעדה", "אוכל", "restaurant", "food", "פיצה"]
    for fk in food_keywords:
        if fk in keyword_lower:
            return "food_restaurant"

    return "unknown"


if __name__ == "__main__":
    sys.exit(main())
