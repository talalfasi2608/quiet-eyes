"""
PDF Generator Service for Quiet Eyes.

Generates weekly strategic brief PDFs with embedded Hebrew font
to prevent RTL/gibberish issues on different devices.

Uses ReportLab with the Heebo (or Assistant) Google Font TTF embedded
directly into the PDF for cross-device compatibility.

Font setup:
    1. Download Heebo-Regular.ttf and Heebo-Bold.ttf from Google Fonts
    2. Place them in backend/fonts/
    3. The generator registers them at startup

If the font files are missing, it falls back to Helvetica (no Hebrew support).
"""

import os
import io
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

# Font directory (relative to backend/)
FONTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fonts")
FONT_REGULAR = os.path.join(FONTS_DIR, "Heebo-Regular.ttf")
FONT_BOLD = os.path.join(FONTS_DIR, "Heebo-Bold.ttf")

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
            logger.info(f"Registered Hebrew font: Heebo (from {FONT_REGULAR})")
        else:
            logger.warning(
                f"Hebrew font not found at {FONT_REGULAR}. "
                f"PDFs will use Helvetica (no Hebrew support). "
                f"Download from: https://fonts.google.com/specimen/Heebo"
            )

        if os.path.exists(FONT_BOLD):
            pdfmetrics.registerFont(TTFont("Heebo-Bold", FONT_BOLD))
        else:
            # If bold is missing, register regular as bold fallback
            if os.path.exists(FONT_REGULAR):
                pdfmetrics.registerFont(TTFont("Heebo-Bold", FONT_REGULAR))

        _fonts_registered = True
    except ImportError:
        logger.warning("reportlab not installed. PDF generation disabled.")
    except Exception as e:
        logger.error(f"Font registration failed: {e}")


def _get_font_name() -> str:
    """Return the font family to use ('Heebo' if available, else 'Helvetica')."""
    if os.path.exists(FONT_REGULAR):
        return "Heebo"
    return "Helvetica"


def _get_bold_font_name() -> str:
    """Return the bold font to use."""
    if os.path.exists(FONT_BOLD) or os.path.exists(FONT_REGULAR):
        return "Heebo-Bold"
    return "Helvetica-Bold"


def _reshape_hebrew(text: str) -> str:
    """
    Apply bidi algorithm to Hebrew text for correct RTL rendering in PDF.
    Uses python-bidi if available, otherwise returns text as-is.
    """
    try:
        from bidi.algorithm import get_display
        return get_display(text)
    except ImportError:
        # Without python-bidi, Hebrew will appear LTR (reversed).
        # This is a known limitation — install python-bidi for proper RTL.
        return text


def _get_supabase():
    try:
        from config import supabase
        return supabase
    except ImportError:
        return None


# =============================================================================
# REPORT DATA GATHERING
# =============================================================================

def _gather_report_data(business_id: str) -> Optional[dict]:
    """Fetch all data needed for the weekly brief from the database."""
    supabase = _get_supabase()
    if not supabase:
        return None

    try:
        # Business info
        biz = (
            supabase.table("businesses")
            .select("business_name, industry, location, pulse_score")
            .eq("id", business_id)
            .single()
            .execute()
        )
        if not biz.data:
            return None

        week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()

        # Competitors
        competitors = (
            supabase.table("competitors")
            .select("name, rating, threat_level")
            .eq("business_id", business_id)
            .limit(5)
            .execute()
        )

        # Leads this week
        leads = (
            supabase.table("leads_discovered")
            .select("status")
            .eq("business_id", business_id)
            .gte("created_at", week_ago)
            .execute()
        )
        lead_data = leads.data or []
        lead_stats = {
            "new": sum(1 for l in lead_data if l.get("status") == "new"),
            "approved": sum(1 for l in lead_data if l.get("status") == "sniped"),
            "rejected": sum(1 for l in lead_data if l.get("status") == "dismissed"),
            "total": len(lead_data),
        }

        # Intel events this week
        events = (
            supabase.table("intelligence_events")
            .select("title, event_type, severity")
            .eq("business_id", business_id)
            .gte("created_at", week_ago)
            .order("created_at", desc=True)
            .limit(10)
            .execute()
        )

        return {
            "business_name": biz.data.get("business_name", ""),
            "industry": biz.data.get("industry", ""),
            "location": biz.data.get("location", ""),
            "health_score": biz.data.get("pulse_score", 0),
            "competitors": competitors.data or [],
            "lead_stats": lead_stats,
            "events": events.data or [],
            "date_range": f"{(datetime.now(timezone.utc) - timedelta(days=7)).strftime('%d/%m')} - {datetime.now(timezone.utc).strftime('%d/%m/%Y')}",
        }
    except Exception as e:
        logger.error(f"Failed to gather report data: {e}")
        return None


# =============================================================================
# PDF GENERATION
# =============================================================================

def generate_weekly_brief(business_id: str) -> Optional[bytes]:
    """
    Generate a weekly strategic brief PDF for a business.

    Returns the PDF bytes, or None if generation fails.
    Also stores the PDF bytes in the `weekly_reports` table if available.
    """
    _register_hebrew_fonts()

    try:
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.colors import HexColor
        from reportlab.platypus import (
            SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        )
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.enums import TA_RIGHT, TA_CENTER
    except ImportError:
        logger.error("reportlab not installed. Run: pip install reportlab")
        return None

    data = _gather_report_data(business_id)
    if not data:
        logger.warning(f"No report data for business {business_id}")
        return None

    font = _get_font_name()
    bold_font = _get_bold_font_name()

    # Styles
    style_title = ParagraphStyle(
        "Title", fontName=bold_font, fontSize=22, alignment=TA_CENTER,
        textColor=HexColor("#FFFFFF"), spaceAfter=8,
    )
    style_subtitle = ParagraphStyle(
        "Subtitle", fontName=font, fontSize=11, alignment=TA_CENTER,
        textColor=HexColor("#9CA3AF"), spaceAfter=20,
    )
    style_heading = ParagraphStyle(
        "Heading", fontName=bold_font, fontSize=14, alignment=TA_RIGHT,
        textColor=HexColor("#818CF8"), spaceAfter=8, spaceBefore=16,
    )
    style_body = ParagraphStyle(
        "Body", fontName=font, fontSize=10, alignment=TA_RIGHT,
        textColor=HexColor("#D1D5DB"), leading=16,
    )
    style_metric = ParagraphStyle(
        "Metric", fontName=bold_font, fontSize=28, alignment=TA_CENTER,
        textColor=HexColor("#FFFFFF"),
    )
    style_metric_label = ParagraphStyle(
        "MetricLabel", fontName=font, fontSize=9, alignment=TA_CENTER,
        textColor=HexColor("#9CA3AF"),
    )

    # Build PDF
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=A4,
        topMargin=20 * mm, bottomMargin=20 * mm,
        leftMargin=15 * mm, rightMargin=15 * mm,
    )

    bg_color = HexColor("#111827")

    def draw_background(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(bg_color)
        canvas.rect(0, 0, A4[0], A4[1], fill=True, stroke=False)
        canvas.restoreState()

    elements = []

    # Title
    biz_name = _reshape_hebrew(data["business_name"])
    elements.append(Paragraph(f"Quiet Eyes - {biz_name}", style_title))
    elements.append(Paragraph(
        _reshape_hebrew(f"{data['industry']} | {data['location']} | {data['date_range']}"),
        style_subtitle,
    ))
    elements.append(Spacer(1, 10 * mm))

    # Health Score + Key Metrics
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

    metrics_table = Table(metrics_data, colWidths=[45 * mm] * 4)
    metrics_table.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#1F2937")),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
        ("TOPPADDING", (0, 0), (-1, -1), 10),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
    ]))
    elements.append(metrics_table)
    elements.append(Spacer(1, 8 * mm))

    # Leads Summary
    elements.append(Paragraph(_reshape_hebrew("סיכום לידים"), style_heading))
    ls = data["lead_stats"]
    leads_text = _reshape_hebrew(
        f"סה\"כ: {ls['total']} | חדשים: {ls['new']} | אושרו: {ls['approved']} | נדחו: {ls['rejected']}"
    )
    elements.append(Paragraph(leads_text, style_body))
    elements.append(Spacer(1, 4 * mm))

    # Top Competitors
    if data["competitors"]:
        elements.append(Paragraph(_reshape_hebrew("מתחרים מובילים"), style_heading))
        for c in data["competitors"][:5]:
            name = _reshape_hebrew(c.get("name", ""))
            rating = c.get("rating", "-")
            threat = c.get("threat_level", "N/A")
            elements.append(Paragraph(
                f"{name}  |  {rating}  |  {threat}",
                style_body,
            ))
        elements.append(Spacer(1, 4 * mm))

    # Intelligence Events
    if data["events"]:
        elements.append(Paragraph(_reshape_hebrew("אירועי מודיעין אחרונים"), style_heading))
        for ev in data["events"][:8]:
            title = _reshape_hebrew(ev.get("title", ""))
            severity = ev.get("severity", "")
            elements.append(Paragraph(f"[{severity}] {title}", style_body))

    # Footer
    elements.append(Spacer(1, 15 * mm))
    elements.append(Paragraph(
        f"Generated by Quiet Eyes | {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}",
        ParagraphStyle("Footer", fontName=font, fontSize=8, alignment=TA_CENTER, textColor=HexColor("#6B7280")),
    ))

    doc.build(elements, onFirstPage=draw_background, onLaterPages=draw_background)
    pdf_bytes = buffer.getvalue()
    buffer.close()

    logger.info(f"Generated PDF for {business_id}: {len(pdf_bytes)} bytes")

    # Optionally store in database
    supabase = _get_supabase()
    if supabase:
        try:
            supabase.table("weekly_reports").insert({
                "business_id": business_id,
                "pdf_size_bytes": len(pdf_bytes),
                "date_range": data["date_range"],
            }).execute()
        except Exception as e:
            logger.debug(f"Could not store report metadata: {e}")

    return pdf_bytes
