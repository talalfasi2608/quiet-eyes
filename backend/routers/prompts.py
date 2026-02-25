"""
Prompt Templates Router.

GET /prompt-templates — returns AI COO quick-action prompt templates.
"""

import logging
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["Prompts"])

TEMPLATES = [
    {
        "id": 1,
        "name": "ניתוח שוק",
        "template_text": "תן לי ניתוח שוק מקיף לעסק שלי — מגמות, הזדמנויות ואיומים.",
        "category": "analysis",
        "icon": "📊",
    },
    {
        "id": 2,
        "name": "איום מתחרה",
        "template_text": "מי המתחרה הכי מסוכן שלי כרגע ומה הוא עושה שאני לא?",
        "category": "competitors",
        "icon": "⚔️",
    },
    {
        "id": 3,
        "name": "הזדמנויות לידים",
        "template_text": "אילו הזדמנויות לידים יש לי עכשיו שאני לא מנצל?",
        "category": "leads",
        "icon": "🎯",
    },
    {
        "id": 4,
        "name": "אסטרטגיית תמחור",
        "template_text": "איך התמחור שלי נראה לעומת המתחרים? מה כדאי לשנות?",
        "category": "strategy",
        "icon": "💰",
    },
    {
        "id": 5,
        "name": "תוכנית שיווק",
        "template_text": "תבנה לי תוכנית שיווק לשבוע הקרוב עם 3 פעולות קונקרטיות.",
        "category": "marketing",
        "icon": "📣",
    },
    {
        "id": 6,
        "name": "שיפור ביקורות",
        "template_text": "מה אני יכול לעשות כדי לשפר את הביקורות והדירוגים שלי בגוגל?",
        "category": "reputation",
        "icon": "⭐",
    },
]


@router.get("/prompt-templates")
async def get_prompt_templates():
    """Return available AI COO prompt templates."""
    return {"templates": TEMPLATES}
