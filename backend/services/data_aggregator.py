"""
Data Aggregator — master orchestrator for all intelligence sources.

Runs all 13 data sources (6 existing + 7 new) in a single mega-scan,
saves results to appropriate DB tables, and returns a unified report.
"""

import json
import logging
from datetime import datetime, timezone
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger(__name__)

_instance = None


@dataclass
class MegaScanReport:
    """Summary of a full mega-scan run."""
    business_id: str
    started_at: str = ""
    finished_at: str = ""
    source_results: dict = field(default_factory=dict)
    errors: list = field(default_factory=list)

    @property
    def sources_ok(self) -> int:
        return sum(1 for v in self.source_results.values() if v.get("status") == "ok")

    @property
    def sources_failed(self) -> int:
        return sum(1 for v in self.source_results.values() if v.get("status") == "error")

    @property
    def sources_partial(self) -> int:
        return sum(1 for v in self.source_results.values() if v.get("status") == "partial")


class DataAggregator:
    """Combines all intelligence sources into a unified mega-scan."""

    def run_mega_scan(self, business_id: str, supabase) -> MegaScanReport:
        """
        Execute all data sources for a business.

        Sources (existing):
         1. Lead Sniper — multi-source lead discovery
         2. Intel Scanner — Facebook groups, registry, Yad2, trends, news
         3. Radar — competitor discovery via Google Places

        Sources (new):
         4. Traffic Analyzer — Google Popular Times
         5. Social Scanner — Facebook, Instagram, TikTok, Twitter, LinkedIn
         6. Price Intelligence — competitor pricing
         7. Event Scanner — holidays, events, weather
         8. Reputation Scanner — multi-platform reputation
         9. Jobs Scanner — competitor hiring signals
        10. Gov Data — government business licenses
        """
        report = MegaScanReport(
            business_id=business_id,
            started_at=datetime.now(timezone.utc).isoformat(),
        )

        # --- SOURCE 1: Lead Sniper ---
        report.source_results["lead_sniper"] = self._run_source(
            "lead_sniper",
            lambda: self._run_lead_sniper(business_id, supabase),
        )

        # --- SOURCE 2: Intel Scanner ---
        report.source_results["intel_scanner"] = self._run_source(
            "intel_scanner",
            lambda: self._run_intel_scanner(business_id, supabase),
        )

        # --- SOURCE 3: Radar (competitor discovery) ---
        report.source_results["radar"] = self._run_source(
            "radar",
            lambda: self._run_radar(business_id, supabase),
        )

        # --- SOURCE 4: Traffic Analyzer ---
        report.source_results["traffic_analyzer"] = self._run_source(
            "traffic_analyzer",
            lambda: self._run_traffic(business_id, supabase),
        )

        # --- SOURCE 5: Social Scanner ---
        report.source_results["social_scanner"] = self._run_source(
            "social_scanner",
            lambda: self._run_social(business_id, supabase),
        )

        # --- SOURCE 6: Price Intelligence ---
        report.source_results["price_intelligence"] = self._run_source(
            "price_intelligence",
            lambda: self._run_prices(business_id, supabase),
        )

        # --- SOURCE 7: Event Scanner ---
        report.source_results["event_scanner"] = self._run_source(
            "event_scanner",
            lambda: self._run_events(business_id, supabase),
        )

        # --- SOURCE 8: Reputation Scanner ---
        report.source_results["reputation_scanner"] = self._run_source(
            "reputation_scanner",
            lambda: self._run_reputation(business_id, supabase),
        )

        # --- SOURCE 9: Jobs Scanner ---
        report.source_results["jobs_scanner"] = self._run_source(
            "jobs_scanner",
            lambda: self._run_jobs(business_id, supabase),
        )

        # --- SOURCE 10: Gov Data ---
        report.source_results["gov_data"] = self._run_source(
            "gov_data",
            lambda: self._run_gov_data(business_id, supabase),
        )

        report.finished_at = datetime.now(timezone.utc).isoformat()

        logger.info(
            f"[MegaScan] Complete for {business_id}: "
            f"✅ {report.sources_ok} OK, "
            f"⚠️ {report.sources_partial} partial, "
            f"❌ {report.sources_failed} failed"
        )
        return report

    # ------------------------------------------------------------------
    # Source runner helper (standardised error handling)
    # ------------------------------------------------------------------

    @staticmethod
    def _run_source(name: str, fn) -> dict:
        """Run a single source with standardised error handling."""
        try:
            result = fn()
            if result is None:
                return {"status": "partial", "detail": "returned None"}
            if isinstance(result, dict) and result.get("error"):
                return {"status": "error", "detail": result["error"]}
            return {"status": "ok", "data": _summarise(result)}
        except Exception as e:
            logger.error(f"[MegaScan] {name} error: {e}")
            return {"status": "error", "detail": str(e)}

    # ------------------------------------------------------------------
    # Individual source wrappers
    # ------------------------------------------------------------------

    @staticmethod
    def _run_lead_sniper(business_id: str, supabase):
        from services.lead_sniper import get_lead_sniper
        report = get_lead_sniper().sniping_mission(business_id, supabase)
        return {
            "leads_found": report.leads_found,
            "leads_saved": report.leads_saved,
            "total_scanned": report.total_results_scanned,
        }

    @staticmethod
    def _run_intel_scanner(business_id: str, supabase):
        from services.intel_scanner import get_intel_scanner
        report = get_intel_scanner().run_full_scan(business_id, supabase)
        return {
            "events": report.total_events,
            "trends": report.total_trends,
            "by_source": report.events_by_source,
        }

    @staticmethod
    def _run_radar(business_id: str, supabase):
        from routers.radar import _discover_competitors
        count = _discover_competitors(business_id, supabase)
        return {"new_competitors": count}

    @staticmethod
    def _run_traffic(business_id: str, supabase):
        from services.traffic_analyzer import get_traffic_analyzer
        return get_traffic_analyzer().scan_business(business_id, supabase)

    @staticmethod
    def _run_social(business_id: str, supabase):
        from services.social_scanner import get_social_scanner
        results = get_social_scanner().scan_business(business_id, supabase)
        # Summarise counts per platform
        summary = {}
        for platform, data in results.items():
            if platform == "error":
                continue
            summary[platform] = len(data) if isinstance(data, list) else 1
        return summary

    @staticmethod
    def _run_prices(business_id: str, supabase):
        from services.price_intelligence import get_price_intelligence
        return get_price_intelligence().scan_business(business_id, supabase)

    @staticmethod
    def _run_events(business_id: str, supabase):
        from services.event_scanner import get_event_scanner
        return get_event_scanner().scan_business(business_id, supabase)

    @staticmethod
    def _run_reputation(business_id: str, supabase):
        from services.reputation_scanner import get_reputation_scanner
        return get_reputation_scanner().scan_business(business_id, supabase)

    @staticmethod
    def _run_jobs(business_id: str, supabase):
        from services.jobs_scanner import get_jobs_scanner
        alerts = get_jobs_scanner().scan_business(business_id, supabase)
        return {"hiring_alerts": len(alerts)}

    @staticmethod
    def _run_gov_data(business_id: str, supabase):
        from services.gov_data import get_gov_data_scanner
        licenses = get_gov_data_scanner().scan_business(business_id, supabase)
        return {"new_licenses": len(licenses)}


def _summarise(data) -> str:
    """Create a short summary string from any data type."""
    if isinstance(data, dict):
        parts = []
        for k, v in data.items():
            if isinstance(v, (int, float)):
                parts.append(f"{k}={v}")
            elif isinstance(v, list):
                parts.append(f"{k}={len(v)}")
            elif isinstance(v, dict):
                parts.append(f"{k}={{...}}")
        return ", ".join(parts) if parts else str(len(data)) + " keys"
    if isinstance(data, list):
        return f"{len(data)} items"
    return str(data)[:100]


# =============================================================================
# Batch runners (for scheduler)
# =============================================================================

def run_mega_scan_all_businesses(supabase) -> int:
    """Run mega scan for all businesses. Returns count of scans run."""
    agg = get_data_aggregator()
    count = 0
    try:
        result = supabase.table("businesses").select("id").execute()
        for biz in (result.data or []):
            try:
                agg.run_mega_scan(biz["id"], supabase)
                count += 1
            except Exception as e:
                logger.error(f"[MegaScan] Error for {biz['id']}: {e}")
    except Exception as e:
        logger.error(f"[MegaScan] Batch error: {e}")
    return count


def update_weather_all_businesses(supabase) -> int:
    """Update weather forecasts for all businesses."""
    from services.event_scanner import get_event_scanner
    scanner = get_event_scanner()
    count = 0
    try:
        result = supabase.table("businesses").select("id").execute()
        for biz in (result.data or []):
            try:
                scanner.scan_business(biz["id"], supabase)
                count += 1
            except Exception:
                pass
    except Exception:
        pass
    return count


def scan_all_competitor_jobs(supabase) -> int:
    """Scan competitor jobs for all businesses."""
    from services.jobs_scanner import get_jobs_scanner
    scanner = get_jobs_scanner()
    count = 0
    try:
        result = supabase.table("businesses").select("id").execute()
        for biz in (result.data or []):
            try:
                scanner.scan_business(biz["id"], supabase)
                count += 1
            except Exception:
                pass
    except Exception:
        pass
    return count


def check_new_licenses_all_cities(supabase) -> int:
    """Check government data for new business licenses."""
    from services.gov_data import get_gov_data_scanner
    scanner = get_gov_data_scanner()
    count = 0
    try:
        result = supabase.table("businesses").select("id").execute()
        for biz in (result.data or []):
            try:
                scanner.scan_business(biz["id"], supabase)
                count += 1
            except Exception:
                pass
    except Exception:
        pass
    return count


# =============================================================================
# SINGLETON
# =============================================================================

def get_data_aggregator() -> DataAggregator:
    global _instance
    if _instance is None:
        _instance = DataAggregator()
    return _instance
