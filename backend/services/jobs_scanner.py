"""
Jobs Scanner — competitor hiring signal detection.

Scans Israeli job sites (AllJobs, JobMaster, Drushim, LinkedIn Jobs)
for competitor job postings.  Hiring = growth = increasing threat.
"""

import os
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_instance = None

JOB_SITES = [
    "drushim.co.il",
    "jobmaster.co.il",
    "alljobs.co.il",
    "linkedin.com/jobs",
    "gotfriends.co.il",
]


class JobsScanner:
    """Detects competitor hiring signals from Israeli job boards."""

    def __init__(self):
        self.serpapi_key = os.getenv("SERPAPI_API_KEY", "")

    def _serp_search(self, query: str, num: int = 5) -> list[dict]:
        if not self.serpapi_key:
            return []
        try:
            resp = httpx.get(
                "https://serpapi.com/search",
                params={
                    "api_key": self.serpapi_key,
                    "engine": "google",
                    "q": query,
                    "tbs": "qdr:m",
                    "num": num,
                    "gl": "il",
                    "hl": "iw",
                },
                timeout=15.0,
            )
            return resp.json().get("organic_results", [])
        except Exception as e:
            logger.debug(f"[JobsScanner] SerpAPI error: {e}")
            return []

    # ------------------------------------------------------------------
    # Scan a single competitor across all job sites
    # ------------------------------------------------------------------

    def scan_competitor_jobs(self, competitor_name: str) -> list[dict]:
        """Search all Israeli job sites for a competitor's listings."""
        findings: list[dict] = []

        for site in JOB_SITES:
            results = self._serp_search(
                f'site:{site} "{competitor_name}"', num=3
            )
            if results:
                findings.append({
                    "job_site": site,
                    "jobs_found": len(results),
                    "listings": [
                        {
                            "title": r.get("title", ""),
                            "snippet": r.get("snippet", ""),
                            "url": r.get("link", ""),
                        }
                        for r in results
                    ],
                })

        return findings

    # ------------------------------------------------------------------
    # Scan all competitors for a business
    # ------------------------------------------------------------------

    def scan_all_competitors(
        self, competitors: list[dict], city: str = ""
    ) -> list[dict]:
        """
        Scan all competitors for job listings.
        Returns alerts for competitors that are hiring.
        """
        alerts: list[dict] = []

        for comp in competitors[:10]:
            comp_name = comp.get("name", "")
            if not comp_name:
                continue

            findings = self.scan_competitor_jobs(comp_name)
            total_jobs = sum(f["jobs_found"] for f in findings)

            if total_jobs > 0:
                severity = "high" if total_jobs >= 3 else "medium"
                alerts.append({
                    "competitor": comp_name,
                    "total_jobs": total_jobs,
                    "sites": [f["job_site"] for f in findings],
                    "findings": findings,
                    "alert": (
                        f"⚠️ {comp_name} מגייס {total_jobs} עובדים — סימן לצמיחה!"
                    ),
                    "severity": severity,
                })

        logger.info(
            f"[JobsScanner] Scanned {len(competitors)} competitors, "
            f"{len(alerts)} hiring alerts"
        )
        return alerts

    # ------------------------------------------------------------------
    # DB-integrated scan
    # ------------------------------------------------------------------

    def scan_business(self, business_id: str, supabase) -> list[dict]:
        """Scan competitor jobs for a business and save alerts."""
        try:
            biz = (
                supabase.table("businesses")
                .select("location")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if not biz.data:
                return []
        except Exception as e:
            logger.error(f"[JobsScanner] DB error: {e}")
            return []

        city = biz.data.get("location", "")

        # Get competitors
        competitors: list[dict] = []
        try:
            comps = (
                supabase.table("competitors")
                .select("name, place_id")
                .eq("business_id", business_id)
                .limit(10)
                .execute()
            )
            competitors = comps.data or []
        except Exception:
            pass

        alerts = self.scan_all_competitors(competitors, city)

        # Save alerts as intelligence events
        for alert in alerts:
            try:
                import json
                supabase.table("intelligence_events").insert({
                    "business_id": business_id,
                    "event_type": "competitor_hiring",
                    "title": alert["alert"],
                    "description": (
                        f"המתחרה {alert['competitor']} פרסם "
                        f"{alert['total_jobs']} משרות "
                        f"באתרים: {', '.join(alert['sites'])}"
                    ),
                    "severity": alert["severity"],
                    "source": "jobs_scanner",
                    "is_read": False,
                    "metadata": json.dumps(
                        {"findings": alert["findings"]},
                        ensure_ascii=False,
                        default=str,
                    ),
                }).execute()
            except Exception as e:
                logger.debug(f"[JobsScanner] Alert save error: {e}")

        return alerts


def get_jobs_scanner() -> JobsScanner:
    global _instance
    if _instance is None:
        _instance = JobsScanner()
    return _instance
