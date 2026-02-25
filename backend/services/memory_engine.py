"""
Memory Engine for Quiet Eyes.

Collects weekly business snapshots and builds rich historical context
for AI-powered conversations and predictions.

Tables used:
  - business_memory   (weekly snapshots with flat metric columns)
  - business_patterns  (AI-discovered recurring patterns)
"""

import json
import re
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

logger = logging.getLogger(__name__)


class MemoryEngine:
    """Manages weekly business snapshots and AI memory context."""

    # ------------------------------------------------------------------
    # snapshot_week  — called every Sunday by scheduler
    # ------------------------------------------------------------------
    def snapshot_week(self, business_id: str, supabase) -> dict:
        """
        Snapshot the current week's data into business_memory.

        Collects real metrics from DB, then asks Claude to summarise
        the week, identify opportunity + threat, and set trend direction.
        """
        now = datetime.now(timezone.utc)
        # week_start = Monday of the current week
        week_start = (now - timedelta(days=now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0
        )
        week_start_str = week_start.strftime("%Y-%m-%d")
        seven_days_ago = (now - timedelta(days=7)).isoformat()

        # ── Collect raw metrics ──────────────────────────────────
        leads_found = 0
        leads_converted = 0
        avg_rating: Optional[float] = None
        review_count = 0
        competitor_count = 0
        top_threat_competitor = ""
        key_events: list[dict] = []

        try:
            # Leads found this week
            ld_res = (
                supabase.table("leads_discovered")
                .select("id, status")
                .eq("business_id", business_id)
                .gte("created_at", seven_days_ago)
                .execute()
            )
            rows = ld_res.data or []
            leads_found = len(rows)
            leads_converted = sum(1 for r in rows if r.get("status") == "converted")
        except Exception as e:
            logger.debug(f"[MemoryEngine] leads query: {e}")

        try:
            # Business rating
            biz_res = (
                supabase.table("businesses")
                .select("google_rating, business_name")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if biz_res.data:
                avg_rating = biz_res.data.get("google_rating")
        except Exception:
            pass

        try:
            # Competitors
            comp_res = (
                supabase.table("competitors")
                .select("name, google_rating")
                .eq("business_id", business_id)
                .execute()
            )
            comps = comp_res.data or []
            competitor_count = len(comps)
            # Highest-rated competitor = top threat
            if comps:
                best = max(comps, key=lambda c: c.get("google_rating") or 0)
                top_threat_competitor = best.get("name", "")
        except Exception:
            pass

        try:
            # Intelligence events this week → key_events
            ev_res = (
                supabase.table("intelligence_events")
                .select("event_type, title, severity, source")
                .eq("business_id", business_id)
                .gte("created_at", seven_days_ago)
                .order("created_at", desc=True)
                .limit(10)
                .execute()
            )
            for ev in ev_res.data or []:
                key_events.append({
                    "type": ev.get("event_type", ""),
                    "title": ev.get("title", ""),
                    "severity": ev.get("severity", "low"),
                })
        except Exception:
            pass

        try:
            # Review count (total for business)
            rev_res = (
                supabase.table("competitors")
                .select("review_count")
                .eq("business_id", business_id)
                .execute()
            )
            review_count = sum(
                (r.get("review_count") or 0) for r in (rev_res.data or [])
            )
        except Exception:
            pass

        # ── Ask Claude to summarise ──────────────────────────────
        weekly_summary = ""
        main_opportunity = ""
        main_threat = ""
        trend_direction = "stable"
        trend_score = 0.0

        try:
            biz_name = ""
            biz_type = ""
            biz_city = ""
            try:
                biz_info = (
                    supabase.table("businesses")
                    .select("business_name, industry, location")
                    .eq("id", business_id)
                    .single()
                    .execute()
                )
                if biz_info.data:
                    biz_name = biz_info.data.get("business_name", "")
                    biz_type = biz_info.data.get("industry", "")
                    biz_city = biz_info.data.get("location", "")
            except Exception:
                pass

            summary_prompt = f"""עסק: {biz_name} ({biz_type} ב{biz_city})

נתוני השבוע:
- לידים שנמצאו: {leads_found}
- לידים שהומרו: {leads_converted}
- דירוג נוכחי: {avg_rating or 'לא ידוע'}
- מתחרים: {competitor_count}
- מתחרה מוביל: {top_threat_competitor}
- אירועים: {json.dumps(key_events, ensure_ascii=False)}

כתוב סיכום שבוע קצר (2 משפטים בעברית),
הזדמנות עיקרית אחת, ואיום עיקרי אחד.
החזר JSON בלבד:
{{
  "summary": "...",
  "opportunity": "...",
  "threat": "...",
  "trend": "improving/declining/stable"
}}"""

            from services.claude_client import analyze
            response = analyze(prompt=summary_prompt, max_tokens=500, temperature=0.4)

            parsed = _parse_json(response)
            if parsed:
                weekly_summary = parsed.get("summary", "")
                main_opportunity = parsed.get("opportunity", "")
                main_threat = parsed.get("threat", "")
                trend_direction = parsed.get("trend", "stable")
                # Simple trend score heuristic
                if trend_direction == "improving":
                    trend_score = 0.7
                elif trend_direction == "declining":
                    trend_score = 0.3
                else:
                    trend_score = 0.5

        except Exception as e:
            logger.warning(f"[MemoryEngine] Claude summary failed: {e}")

        # ── Upsert to DB ────────────────────────────────────────
        row = {
            "business_id": business_id,
            "week_start": week_start_str,
            "leads_found": leads_found,
            "leads_converted": leads_converted,
            "avg_rating": avg_rating,
            "review_count": review_count,
            "competitor_count": competitor_count,
            "top_threat_competitor": top_threat_competitor,
            "key_events": key_events,
            "weekly_summary": weekly_summary,
            "main_opportunity": main_opportunity,
            "main_threat": main_threat,
            "trend_direction": trend_direction,
            "trend_score": trend_score,
        }

        try:
            supabase.table("business_memory").upsert(
                row, on_conflict="business_id,week_start"
            ).execute()
            logger.info(
                f"[MemoryEngine] Snapshot saved for {business_id} week {week_start_str}"
            )
        except Exception as e:
            logger.error(f"[MemoryEngine] Failed to save snapshot: {e}")

        return row

    # ------------------------------------------------------------------
    # get_context_for_ai  — injected into every Claude prompt
    # ------------------------------------------------------------------
    def get_context_for_ai(self, business_id: str, supabase, weeks: int = 12) -> str:
        """
        Build rich Hebrew context from last N weeks of memory
        for injection into Claude system prompts.
        """
        try:
            rows = (
                supabase.table("business_memory")
                .select("*")
                .eq("business_id", business_id)
                .order("week_start", desc=True)
                .limit(weeks)
                .execute()
            )
            if not rows.data:
                return ""

            context = "היסטוריה עסקית (שבועות אחרונים):\n"
            for mem in reversed(rows.data):
                context += f"""
שבוע {mem.get('week_start', '?')}:
- לידים: {mem.get('leads_found', 0)} | הומרו: {mem.get('leads_converted', 0)}
- דירוג: {mem.get('avg_rating') or 'לא ידוע'}
- מגמה: {mem.get('trend_direction', 'stable')}
- סיכום: {mem.get('weekly_summary', '')}
- הזדמנות: {mem.get('main_opportunity', '')}
- איום: {mem.get('main_threat', '')}
"""

            # Append discovered patterns
            try:
                pat_res = (
                    supabase.table("business_patterns")
                    .select("pattern_type, pattern_data, confidence")
                    .eq("business_id", business_id)
                    .order("discovered_at", desc=True)
                    .limit(5)
                    .execute()
                )
                patterns = pat_res.data or []
                if patterns:
                    context += "\nדפוסים שזוהו:\n"
                    for p in patterns:
                        pd = p.get("pattern_data", {})
                        if isinstance(pd, str):
                            try:
                                pd = json.loads(pd)
                            except Exception:
                                pd = {}
                        desc = pd.get("description", p.get("pattern_type", ""))
                        conf = p.get("confidence", 0)
                        context += f"- {desc} (ביטחון {int(conf * 100)}%)\n"
            except Exception:
                pass

            return context

        except Exception as e:
            logger.debug(f"[MemoryEngine] get_context_for_ai failed: {e}")
            return ""

    # ------------------------------------------------------------------
    # detect_patterns  — run monthly
    # ------------------------------------------------------------------
    def detect_patterns(self, business_id: str, supabase) -> list[dict]:
        """
        Find recurring patterns in historical data using Claude.
        Saves results to business_patterns table.
        """
        try:
            rows = (
                supabase.table("business_memory")
                .select("*")
                .eq("business_id", business_id)
                .order("week_start", desc=True)
                .limit(12)
                .execute()
            )
            if not rows.data or len(rows.data) < 2:
                return []

            # Build memory dump for Claude
            memory_dump = []
            for m in reversed(rows.data):
                memory_dump.append({
                    "week": m.get("week_start"),
                    "leads": m.get("leads_found", 0),
                    "converted": m.get("leads_converted", 0),
                    "rating": m.get("avg_rating"),
                    "competitors": m.get("competitor_count", 0),
                    "trend": m.get("trend_direction", "stable"),
                    "events": m.get("key_events", []),
                })

            prompt = f"""נתח את הנתונים הבאים של עסק ישראלי ומצא דפוסים חוזרים:

{json.dumps(memory_dump, ensure_ascii=False, indent=2)}

חפש:
1. דפוסים עונתיים (מה קורה בחגים?)
2. דפוסי מתחרים (מה הם עושים לפני חגים?)
3. מקורות לידים (מאיפה מגיעים הלידים הטובים?)
4. מגמות דירוג

החזר JSON בלבד:
{{
  "patterns": [
    {{
      "type": "seasonal",
      "description": "תיאור בעברית",
      "confidence": 0.85,
      "action": "מה לעשות בהתבסס על הדפוס"
    }}
  ]
}}"""

            from services.claude_client import analyze
            response = analyze(prompt=prompt, max_tokens=1500, temperature=0.4)

            parsed = _parse_json(response)
            patterns = parsed.get("patterns", []) if parsed else []

            # Save each pattern
            saved = []
            for p in patterns[:5]:
                try:
                    supabase.table("business_patterns").insert({
                        "business_id": business_id,
                        "pattern_type": p.get("type", "general"),
                        "pattern_data": p,
                        "confidence": p.get("confidence", 0.5),
                    }).execute()
                    saved.append(p)
                except Exception as e:
                    logger.debug(f"[MemoryEngine] pattern save error: {e}")

            logger.info(
                f"[MemoryEngine] Detected {len(saved)} patterns for {business_id}"
            )
            return saved

        except Exception as e:
            logger.error(f"[MemoryEngine] detect_patterns error: {e}")
            return []


# ═══════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════

def _parse_json(text: str) -> Optional[dict]:
    """Parse JSON from Claude response, with regex fallback."""
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        if m:
            try:
                return json.loads(m.group())
            except json.JSONDecodeError:
                pass
    return None


# ═══════════════════════════════════════════════════════════════
# Singleton
# ═══════════════════════════════════════════════════════════════

_instance: Optional[MemoryEngine] = None


def get_memory_engine() -> MemoryEngine:
    global _instance
    if _instance is None:
        _instance = MemoryEngine()
    return _instance
