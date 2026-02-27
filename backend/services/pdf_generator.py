"""
PDF Generator Service for Quiet Eyes — Phase 4 War Room Report.

Generates premium multi-page weekly intelligence PDFs with:
- Dark navy Palantir-style design via HTML/CSS + WeasyPrint
- AI-generated narratives via Claude
- 6 sections: Executive Summary, Leads, Reputation, Competitors, Action Plan
- Hebrew RTL support via web fonts

Falls back to ReportLab if WeasyPrint is not installed.

Dependencies: pip install weasyprint jinja2
Fonts: backend/fonts/Heebo-Regular.ttf, Heebo-Bold.ttf
"""

import os
import io
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# Paths
TEMPLATES_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "templates")
FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fonts")
FONT_REGULAR = os.path.join(FONTS_DIR, "Heebo-Regular.ttf")
FONT_BOLD = os.path.join(FONTS_DIR, "Heebo-Bold.ttf")


def _get_supabase():
    """Get a Supabase client — prefers service-role to bypass RLS."""
    try:
        from supabase import create_client
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


# =============================================================================
# ENHANCED DATA GATHERING
# =============================================================================

def _gather_report_data(business_id: str) -> Optional[dict]:
    """Fetch all data needed for the weekly War Room report."""
    supabase = _get_supabase()
    if not supabase:
        return None

    try:
        # Business info
        biz_data = None
        try:
            biz = (
                supabase.table("businesses")
                .select("business_name, industry, location, google_rating, pulse_score")
                .eq("id", business_id)
                .maybe_single()
                .execute()
            )
            biz_data = biz.data
        except Exception as e:
            logger.debug(f"businesses query failed: {e}")

        if not biz_data:
            try:
                ws = supabase.table("workspaces").select("name").limit(1).execute()
                ws_name = ws.data[0]["name"] if ws.data else "Business"
                biz_data = {"business_name": ws_name, "industry": "", "location": "", "google_rating": None, "pulse_score": 0}
            except Exception:
                biz_data = {"business_name": "Business", "industry": "", "location": "", "google_rating": None, "pulse_score": 0}

        now = datetime.now(timezone.utc)
        week_ago = (now - timedelta(days=7)).isoformat()
        two_weeks_ago = (now - timedelta(days=14)).isoformat()

        # Competitors
        competitors_data = []
        try:
            competitors = (
                supabase.table("competitors")
                .select("id, name, google_rating, review_count, perceived_threat_level")
                .eq("business_id", business_id)
                .limit(8)
                .execute()
            )
            for c in (competitors.data or []):
                competitors_data.append({
                    "name": c.get("name", ""),
                    "rating": c.get("google_rating", "-"),
                    "review_count": c.get("review_count", 0) or 0,
                    "threat_level": c.get("perceived_threat_level", "low"),
                })
        except Exception as e:
            logger.debug(f"competitors query error: {e}")

        # Leads this week
        lead_data = []
        try:
            leads = (
                supabase.table("leads_discovered")
                .select("lead_name, platform, relevance_score, status")
                .eq("business_id", business_id)
                .gte("created_at", week_ago)
                .order("relevance_score", desc=True)
                .limit(50)
                .execute()
            )
            lead_data = leads.data or []
        except Exception as e:
            logger.debug(f"leads query error: {e}")

        # Leads previous week (for comparison)
        prev_lead_count = 0
        try:
            prev_leads = (
                supabase.table("leads_discovered")
                .select("id")
                .eq("business_id", business_id)
                .gte("created_at", two_weeks_ago)
                .lt("created_at", week_ago)
                .execute()
            )
            prev_lead_count = len(prev_leads.data or [])
        except Exception:
            pass

        # Lead stats
        lead_stats = {
            "new": sum(1 for l in lead_data if l.get("status") == "new"),
            "approved": sum(1 for l in lead_data if l.get("status") in ("sniped", "contacted")),
            "rejected": sum(1 for l in lead_data if l.get("status") == "dismissed"),
            "total": len(lead_data),
        }

        # Leads by platform
        platform_counts: dict[str, int] = {}
        for l in lead_data:
            p = l.get("platform", "other") or "other"
            platform_counts[p] = platform_counts.get(p, 0) + 1

        # Hot leads (score >= 0.8)
        hot_leads = [
            {
                "name": l.get("lead_name", "ליד"),
                "platform": l.get("platform", ""),
                "score": int((l.get("relevance_score", 0) or 0) * 100),
                "status": l.get("status", "new"),
            }
            for l in lead_data if (l.get("relevance_score", 0) or 0) >= 0.8
        ][:5]

        # Intelligence events this week
        events_data = []
        try:
            events = (
                supabase.table("intelligence_events")
                .select("title, event_type, severity, description")
                .eq("business_id", business_id)
                .gte("created_at", week_ago)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            events_data = events.data or []
        except Exception as e:
            logger.debug(f"intelligence_events query error: {e}")

        # Review events (for reputation section)
        review_events = [e for e in events_data if e.get("event_type") == "new_review"]

        # Memory context
        memory_context = ""
        try:
            from services.memory_engine import get_memory_engine
            memory_context = get_memory_engine().get_context_for_ai(business_id, supabase)
        except Exception:
            pass

        # Prediction
        prediction_data = None
        try:
            from services.prediction_engine import get_prediction_engine
            prediction_data = get_prediction_engine().get_latest_prediction(business_id, supabase)
        except Exception:
            pass

        # Calculate market position (rank among competitors by rating)
        current_rating = biz_data.get("google_rating") or 0
        ratings = [c.get("rating", 0) for c in competitors_data if isinstance(c.get("rating"), (int, float))]
        ratings.append(current_rating)
        ratings.sort(reverse=True)
        market_position = ratings.index(current_rating) + 1 if current_rating in ratings else len(ratings)

        # Week dates
        week_start = (now - timedelta(days=7)).strftime("%d/%m")
        week_end = now.strftime("%d/%m/%Y")

        return {
            "business_name": biz_data.get("business_name", ""),
            "industry": biz_data.get("industry", ""),
            "location": biz_data.get("location", ""),
            "current_rating": current_rating,
            "health_score": biz_data.get("pulse_score", 0) or 0,
            "competitors": competitors_data,
            "lead_stats": lead_stats,
            "leads_by_platform": platform_counts,
            "hot_leads": hot_leads,
            "prev_lead_count": prev_lead_count,
            "events": events_data,
            "review_events": review_events,
            "market_position": market_position,
            "memory_context": memory_context,
            "prediction": prediction_data,
            "date_range": f"{week_start} - {week_end}",
            "week_start": week_start,
            "week_end": week_end,
        }
    except Exception as e:
        logger.error(f"Failed to gather report data: {e}")
        return None


# =============================================================================
# AI NARRATIVE GENERATION
# =============================================================================

def _generate_narratives(data: dict) -> dict:
    """Generate AI narratives for each report section using Claude."""
    defaults = {
        "executive_summary": "לא נוצר סיכום מנהלים.",
        "leads_narrative": "לא נוצר ניתוח לידים.",
        "reputation_narrative": "לא נוצר ניתוח מוניטין.",
        "competitor_narrative": "לא נוצר ניתוח מתחרים.",
        "opportunity_of_week": "",
        "action_plan": [],
    }

    try:
        from services.claude_client import analyze
    except ImportError:
        return defaults

    # Build data summary for Claude
    comp_summary = "\n".join(
        f"- {c['name']}: דירוג {c['rating']}, {c['review_count']} ביקורות, איום {c['threat_level']}"
        for c in data.get("competitors", [])[:5]
    ) or "אין מתחרים"

    events_summary = "\n".join(
        f"- [{e.get('severity', '')}] {e.get('title', '')}"
        for e in data.get("events", [])[:8]
    ) or "אין אירועים"

    prediction_text = ""
    if data.get("prediction"):
        pred = data["prediction"]
        prediction_text = pred.get("prediction_text", pred.get("summary", ""))

    ls = data.get("lead_stats", {})
    leads_change = 0
    if data.get("prev_lead_count", 0) > 0:
        leads_change = int(((ls.get("total", 0) - data["prev_lead_count"]) / data["prev_lead_count"]) * 100)

    prompt = f"""אתה מנהל שיווק מקצועי שכותב דוח שבועי לבעל עסק ישראלי.

עסק: {data.get('business_name', '')} ({data.get('industry', '')} ב{data.get('location', '')})
דירוג גוגל: {data.get('current_rating', 'N/A')}
ציון בריאות: {data.get('health_score', 0)}
מיקום בשוק: #{data.get('market_position', '?')}

לידים השבוע: {ls.get('total', 0)} (שינוי: {leads_change}% משבוע שעבר)
- חדשים: {ls.get('new', 0)}
- אושרו: {ls.get('approved', 0)}
- נדחו: {ls.get('rejected', 0)}

מתחרים:
{comp_summary}

אירועי מודיעין:
{events_summary}

{f'תחזית: {prediction_text}' if prediction_text else ''}
{f'הקשר היסטורי: {data.get("memory_context", "")[:600]}' if data.get("memory_context") else ''}

החזר JSON בלבד (ללא markdown) עם השדות:
{{
  "executive_summary": "2-3 משפטים מסכמים את השבוע. מה היה טוב? מה דרש שיפור?",
  "leads_narrative": "ניתוח קצר של הלידים השבוע. מאיפה הגיעו? מה איכותם? 2-3 משפטים.",
  "reputation_narrative": "ניתוח המוניטין. האם הדירוג השתנה? מה הרגש הכללי? 2-3 משפטים.",
  "competitor_narrative": "מה עשו המתחרים? מה זה אומר לעסק שלנו? 2-3 משפטים.",
  "opportunity_of_week": "ההזדמנות הכי גדולה לשבוע הבא - ספציפית. משפט אחד.",
  "action_plan": [
    {{
      "priority": 1,
      "action": "פעולה ספציפית קצרה",
      "reason": "למה זה חשוב - משפט אחד",
      "expected_result": "מה תשיג - משפט אחד",
      "time_required": "כמה זמן (לדוגמה: 30 דקות)"
    }},
    {{
      "priority": 2,
      "action": "...",
      "reason": "...",
      "expected_result": "...",
      "time_required": "..."
    }},
    {{
      "priority": 3,
      "action": "...",
      "reason": "...",
      "expected_result": "...",
      "time_required": "..."
    }}
  ]
}}"""

    try:
        raw = analyze(prompt, max_tokens=2000, temperature=0.7)
        raw = raw.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0]
        result = json.loads(raw)
        # Ensure action_plan items have required fields
        for item in result.get("action_plan", []):
            item.setdefault("priority", 0)
            item.setdefault("action", "")
            item.setdefault("reason", "")
            item.setdefault("expected_result", "")
            item.setdefault("time_required", "")
        return result
    except json.JSONDecodeError:
        logger.error("[WeeklyReport] JSON parse error from Claude")
        return defaults
    except Exception as e:
        logger.error(f"[WeeklyReport] Claude narrative error: {e}")
        return defaults


# =============================================================================
# WEASYPRINT PDF GENERATION (PRIMARY)
# =============================================================================

def _generate_pdf_weasyprint(data: dict, narratives: dict) -> Optional[bytes]:
    """Generate a premium multi-page PDF using WeasyPrint + Jinja2 HTML template."""
    try:
        from weasyprint import HTML
        from jinja2 import Environment, FileSystemLoader
    except ImportError:
        logger.debug("weasyprint/jinja2 not installed, falling back to reportlab")
        return None

    # Load template
    template_path = os.path.join(TEMPLATES_DIR, "weekly_report.html")
    if not os.path.exists(template_path):
        logger.error(f"Template not found: {template_path}")
        return None

    env = Environment(loader=FileSystemLoader(TEMPLATES_DIR))
    template = env.get_template("weekly_report.html")

    # Prepare template variables
    ls = data.get("lead_stats", {})
    total_leads = ls.get("total", 0)
    prev_leads = data.get("prev_lead_count", 0)
    leads_change_pct = int(((total_leads - prev_leads) / prev_leads) * 100) if prev_leads > 0 else 0

    current_rating = data.get("current_rating", 0) or 0
    star_count = int(current_rating) if current_rating else 0

    # Leads by platform for bar chart
    platform_data = data.get("leads_by_platform", {})
    max_platform = max(platform_data.values()) if platform_data else 1
    leads_by_platform = [
        {"name": name, "count": count, "percent": int((count / max_platform) * 100)}
        for name, count in sorted(platform_data.items(), key=lambda x: x[1], reverse=True)
    ]

    # Competitors table data
    threat_labels = {"high": "גבוה", "medium": "בינוני", "low": "נמוך"}
    threat_classes = {"high": "high", "medium": "medium", "low": "low"}
    competitors_table = []

    # Add self row
    competitors_table.append({
        "name": f"{data.get('business_name', '')} (אתה)",
        "rating": f"{current_rating}" if current_rating else "-",
        "review_count": "-",
        "change_display": "-",
        "change_class": "",
        "threat_label": "-",
        "threat_class": "low",
        "is_self": True,
    })

    for c in data.get("competitors", [])[:5]:
        threat = c.get("threat_level", "low")
        competitors_table.append({
            "name": c.get("name", ""),
            "rating": f"{c.get('rating', '-')}",
            "review_count": c.get("review_count", 0),
            "change_display": "-",
            "change_class": "",
            "threat_label": threat_labels.get(threat, threat),
            "threat_class": threat_classes.get(threat, "low"),
            "is_self": False,
        })

    # Review data for reputation section
    review_events = data.get("review_events", [])
    recent_reviews = []
    for r in review_events[:3]:
        details = r.get("details", {}) if isinstance(r.get("details"), dict) else {}
        rating = details.get("rating", 0)
        text = details.get("review_text", r.get("description", ""))
        recent_reviews.append({
            "stars": "★" * int(rating) if rating else "",
            "text": (text[:150] + "...") if len(text or "") > 150 else (text or ""),
        })

    positive_count = sum(1 for r in review_events if (r.get("details", {}) or {}).get("rating", 0) >= 4)
    positive_pct = int((positive_count / len(review_events)) * 100) if review_events else 0

    # Conversion rate
    conversion_rate = 0
    if total_leads > 0:
        conversion_rate = int((ls.get("approved", 0) / total_leads) * 100)

    # Render HTML
    context = {
        # Cover
        "report_title": "דוח מודיעין שוק\nשבועי",
        "business_name": data.get("business_name", ""),
        "location": data.get("location", ""),
        "week_start": data.get("week_start", ""),
        "week_end": data.get("week_end", ""),
        "week_dates": data.get("date_range", ""),
        "confidential_label": "סודי ואישי",
        "footer_label": "מודיעין עסקי",
        "page_label": "עמוד",

        # Section tags & titles
        "section_01_tag": "סעיף 01",
        "section_01_title": "תקציר מנהלים",
        "section_02_tag": "סעיף 02",
        "section_02_title": "דוח לידים",
        "section_03_tag": "סעיף 03",
        "section_03_title": "דוח מוניטין",
        "section_04_tag": "סעיף 04",
        "section_04_title": "ניתוח מתחרים",
        "section_05_tag": "סעיף 05",
        "section_05_title": "תוכנית פעולה לשבוע הבא",

        # KPIs
        "total_leads": total_leads,
        "leads_label": "לידים השבוע",
        "leads_change_class": "up" if leads_change_pct > 0 else "down" if leads_change_pct < 0 else "neutral",
        "leads_change_text": f"{'+'if leads_change_pct > 0 else ''}{leads_change_pct}% משבוע שעבר",
        "current_rating": f"{current_rating}" if current_rating else "-",
        "rating_label": "דירוג גוגל",
        "rating_change_class": "neutral",
        "rating_change_text": "ללא שינוי",
        "market_position": data.get("market_position", "?"),
        "position_label": "מיקום בשוק",
        "competitor_count": len(data.get("competitors", [])),
        "competitors_word": "מתחרים",
        "health_score": data.get("health_score", 0),
        "health_label": "ציון בריאות",
        "health_change_class": "up" if data.get("health_score", 0) >= 70 else "down" if data.get("health_score", 0) < 40 else "neutral",
        "health_change_text": "מצוין" if data.get("health_score", 0) >= 70 else "דורש שיפור" if data.get("health_score", 0) < 40 else "סביר",

        # Narratives
        "executive_summary": narratives.get("executive_summary", ""),
        "leads_narrative": narratives.get("leads_narrative", ""),
        "reputation_narrative": narratives.get("reputation_narrative", ""),
        "competitor_narrative": narratives.get("competitor_narrative", ""),
        "opportunity_of_week": narratives.get("opportunity_of_week", ""),
        "opportunity_title": "הזדמנות השבוע",

        # Leads section
        "total_leads_label": "סה\"כ לידים",
        "hot_leads_count": len(data.get("hot_leads", [])),
        "hot_leads_label": "לידים חמים",
        "conversion_rate": conversion_rate,
        "conversion_label": "שיעור המרה",
        "leads_by_platform_title": "לידים לפי פלטפורמה",
        "leads_by_platform": leads_by_platform,
        "hot_leads_title": "לידים חמים מובילים",
        "hot_leads": data.get("hot_leads", []),
        "lead_name_header": "שם",
        "lead_platform_header": "פלטפורמה",
        "lead_score_header": "רלוונטיות",
        "lead_status_header": "סטטוס",

        # Reputation section
        "star_display": "★" * star_count + "☆" * (5 - star_count),
        "of_5": "מתוך 5",
        "new_reviews_count": len(review_events),
        "new_reviews_label": "ביקורות חדשות",
        "positive_pct": positive_pct,
        "positive_label": "חיוביות",
        "recent_reviews_title": "ביקורות אחרונות",
        "recent_reviews": recent_reviews,

        # Competitors section
        "competitors": competitors_table,
        "comp_name_header": "עסק",
        "comp_rating_header": "דירוג",
        "comp_reviews_header": "ביקורות",
        "comp_change_header": "שינוי",
        "comp_threat_header": "איום",

        # Action plan
        "action_plan": narratives.get("action_plan", []),
        "time_icon": "⏱",
        "target_icon": "🎯",
    }

    try:
        html_str = template.render(**context)
        pdf_bytes = HTML(string=html_str).write_pdf()
        logger.info(f"[WeeklyReport] WeasyPrint PDF generated: {len(pdf_bytes)} bytes")
        return pdf_bytes
    except Exception as e:
        logger.error(f"[WeeklyReport] WeasyPrint render error: {e}")
        return None


# =============================================================================
# REPORTLAB FALLBACK (LEGACY)
# =============================================================================

_fonts_registered = False


def _register_hebrew_fonts():
    """Register Heebo TTF fonts with ReportLab's font system."""
    global _fonts_registered
    if _fonts_registered:
        return
    try:
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        if os.path.exists(FONT_REGULAR):
            pdfmetrics.registerFont(TTFont("Heebo", FONT_REGULAR))
        if os.path.exists(FONT_BOLD):
            pdfmetrics.registerFont(TTFont("Heebo-Bold", FONT_BOLD))
        elif os.path.exists(FONT_REGULAR):
            pdfmetrics.registerFont(TTFont("Heebo-Bold", FONT_REGULAR))
        _fonts_registered = True
    except ImportError:
        logger.warning("reportlab not installed")
    except Exception as e:
        logger.error(f"Font registration failed: {e}")


def _get_font_name() -> str:
    return "Heebo" if os.path.exists(FONT_REGULAR) else "Helvetica"


def _get_bold_font_name() -> str:
    return "Heebo-Bold" if (os.path.exists(FONT_BOLD) or os.path.exists(FONT_REGULAR)) else "Helvetica-Bold"


def _reshape_hebrew(text: str) -> str:
    try:
        from bidi.algorithm import get_display
        return get_display(text)
    except ImportError:
        return text


def _generate_pdf_reportlab(data: dict) -> Optional[bytes]:
    """Fallback: generate a basic PDF using ReportLab."""
    _register_hebrew_fonts()

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.colors import HexColor
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.enums import TA_RIGHT, TA_CENTER
    except ImportError:
        logger.error("reportlab not installed. Run: pip install reportlab")
        return None

    font = _get_font_name()
    bold_font = _get_bold_font_name()

    style_title = ParagraphStyle("Title", fontName=bold_font, fontSize=22, alignment=TA_CENTER, textColor=HexColor("#FFFFFF"), spaceAfter=8)
    style_subtitle = ParagraphStyle("Subtitle", fontName=font, fontSize=11, alignment=TA_CENTER, textColor=HexColor("#9CA3AF"), spaceAfter=20)
    style_heading = ParagraphStyle("Heading", fontName=bold_font, fontSize=14, alignment=TA_RIGHT, textColor=HexColor("#818CF8"), spaceAfter=8, spaceBefore=16)
    style_body = ParagraphStyle("Body", fontName=font, fontSize=10, alignment=TA_RIGHT, textColor=HexColor("#D1D5DB"), leading=16)
    style_metric = ParagraphStyle("Metric", fontName=bold_font, fontSize=28, alignment=TA_CENTER, textColor=HexColor("#FFFFFF"))
    style_metric_label = ParagraphStyle("MetricLabel", fontName=font, fontSize=9, alignment=TA_CENTER, textColor=HexColor("#9CA3AF"))

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=20*mm, bottomMargin=20*mm, leftMargin=15*mm, rightMargin=15*mm)
    bg_color = HexColor("#111827")

    def draw_background(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(bg_color)
        canvas.rect(0, 0, A4[0], A4[1], fill=True, stroke=False)
        canvas.restoreState()

    elements = []

    biz_name = _reshape_hebrew(data["business_name"])
    elements.append(Paragraph(f"Quiet Eyes - {biz_name}", style_title))
    elements.append(Paragraph(_reshape_hebrew(f"{data['industry']} | {data['location']} | {data['date_range']}"), style_subtitle))
    elements.append(Spacer(1, 10*mm))

    score = data.get("health_score", 0)
    score_color = "#10B981" if score >= 70 else "#F59E0B" if score >= 40 else "#EF4444"

    metrics_data = [
        [
            Paragraph(str(score), ParagraphStyle("s", parent=style_metric, textColor=HexColor(score_color))),
            Paragraph(str(data["lead_stats"]["total"]), style_metric),
            Paragraph(str(len(data["competitors"])), style_metric),
            Paragraph(str(len(data["events"])), style_metric),
        ],
        [
            Paragraph(_reshape_hebrew("ציון בריאות"), style_metric_label),
            Paragraph(_reshape_hebrew("לידים השבוע"), style_metric_label),
            Paragraph(_reshape_hebrew("מתחרים"), style_metric_label),
            Paragraph(_reshape_hebrew("אירועים"), style_metric_label),
        ],
    ]

    metrics_table = Table(metrics_data, colWidths=[45*mm]*4)
    metrics_table.setStyle(TableStyle([
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("BACKGROUND", (0,0), (-1,-1), HexColor("#1F2937")),
        ("ROUNDEDCORNERS", [8,8,8,8]),
        ("TOPPADDING", (0,0), (-1,-1), 10),
        ("BOTTOMPADDING", (0,0), (-1,-1), 10),
    ]))
    elements.append(metrics_table)
    elements.append(Spacer(1, 8*mm))

    # Leads
    elements.append(Paragraph(_reshape_hebrew("סיכום לידים"), style_heading))
    ls = data["lead_stats"]
    elements.append(Paragraph(_reshape_hebrew(f"סה\"כ: {ls['total']} | חדשים: {ls['new']} | אושרו: {ls['approved']} | נדחו: {ls['rejected']}"), style_body))
    elements.append(Spacer(1, 4*mm))

    # Competitors
    if data["competitors"]:
        elements.append(Paragraph(_reshape_hebrew("מתחרים מובילים"), style_heading))
        for c in data["competitors"][:5]:
            elements.append(Paragraph(f"{_reshape_hebrew(c.get('name',''))}  |  {c.get('rating','-')}  |  {c.get('threat_level','N/A')}", style_body))
        elements.append(Spacer(1, 4*mm))

    # Events
    if data["events"]:
        elements.append(Paragraph(_reshape_hebrew("אירועי מודיעין אחרונים"), style_heading))
        for ev in data["events"][:8]:
            elements.append(Paragraph(f"[{ev.get('severity','')}] {_reshape_hebrew(ev.get('title',''))}", style_body))

    elements.append(Spacer(1, 15*mm))
    elements.append(Paragraph(
        f"Generated by Quiet Eyes | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        ParagraphStyle("Footer", fontName=font, fontSize=8, alignment=TA_CENTER, textColor=HexColor("#6B7280")),
    ))

    doc.build(elements, onFirstPage=draw_background, onLaterPages=draw_background)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

def generate_weekly_brief(business_id: str) -> Optional[bytes]:
    """
    Generate a weekly strategic brief PDF for a business.

    Tries WeasyPrint (premium HTML template) first,
    falls back to ReportLab (basic) if unavailable.

    Returns the PDF bytes, or None if generation fails.
    """
    data = _gather_report_data(business_id)
    if not data:
        logger.warning(f"No report data for business {business_id}")
        return None

    # Generate AI narratives
    narratives = _generate_narratives(data)

    # Store narratives in data for preview endpoint access
    data["narratives"] = narratives

    # Try WeasyPrint first (premium)
    pdf_bytes = _generate_pdf_weasyprint(data, narratives)

    # Fallback to ReportLab
    if not pdf_bytes:
        logger.info("[WeeklyReport] Falling back to ReportLab")
        pdf_bytes = _generate_pdf_reportlab(data)

    if not pdf_bytes:
        return None

    logger.info(f"Generated PDF for {business_id}: {len(pdf_bytes)} bytes")

    # Store PDF in Supabase
    supabase = _get_supabase()
    if supabase:
        pdf_url = None
        try:
            file_name = f"{business_id}/{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.pdf"
            supabase.storage.from_("reports").upload(
                file_name, pdf_bytes,
                {"content-type": "application/pdf", "upsert": "true"},
            )
            pdf_url = supabase.storage.from_("reports").get_public_url(file_name)
        except Exception as e:
            logger.debug(f"Could not upload PDF to storage: {e}")

        try:
            row = {
                "business_id": business_id,
                "pdf_size_bytes": len(pdf_bytes),
                "date_range": data["date_range"],
            }
            if pdf_url:
                row["pdf_url"] = pdf_url
            supabase.table("weekly_reports").insert(row).execute()
        except Exception as e:
            logger.debug(f"Could not store report metadata: {e}")

    return pdf_bytes
