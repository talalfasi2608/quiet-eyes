"""
Government Data — Israeli open data integration (data.gov.il).

Fetches business license registrations from the Israeli government's
CKAN open-data API to detect new competitors entering the market.
"""

import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_instance = None

# data.gov.il CKAN resource IDs for business-related datasets
BUSINESS_LICENSE_RESOURCE = "3aef9e36-9bd8-4e22-bdaa-f3eba8cd1833"
# Fallback resource ID (business registry)
BUSINESS_REGISTRY_RESOURCE = "f004176c-b85f-4542-8901-7b3176f9a054"


class GovDataScanner:
    """Fetches Israeli government open data for competitive intelligence."""

    def _ckan_search(
        self, resource_id: str, query: str, filters: dict = None, limit: int = 20
    ) -> list[dict]:
        """Generic CKAN datastore search against data.gov.il."""
        params: dict = {
            "resource_id": resource_id,
            "q": query,
            "limit": limit,
        }
        if filters:
            params["filters"] = json.dumps(filters, ensure_ascii=False)

        try:
            resp = httpx.get(
                "https://data.gov.il/api/3/action/datastore_search",
                params=params,
                timeout=15.0,
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            if not data.get("success"):
                return []
            return data.get("result", {}).get("records", [])
        except Exception as e:
            logger.debug(f"[GovData] CKAN search error: {e}")
            return []

    # ------------------------------------------------------------------
    # Business license search
    # ------------------------------------------------------------------

    def get_business_licenses(
        self, city: str, business_type: str, days_back: int = 90
    ) -> list[dict]:
        """
        Search for new business licenses in a city.
        New licenses = potential new competitors.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days_back)
        new_licenses: list[dict] = []

        # Try primary resource (business licenses)
        records = self._ckan_search(
            BUSINESS_LICENSE_RESOURCE,
            query=f"{city} {business_type}",
            filters={"שם_ישוב": city} if city else None,
            limit=20,
        )

        # If primary fails, try fallback resource (business registry)
        if not records:
            records = self._ckan_search(
                BUSINESS_REGISTRY_RESOURCE,
                query=f"{business_type} {city}",
                limit=20,
            )

        for rec in records:
            # Extract business name (try multiple column name patterns)
            biz_name = (
                rec.get("שם_עסק")
                or rec.get("entity_name")
                or rec.get("שם_חברה")
                or rec.get("שם")
                or ""
            )
            if not biz_name:
                continue

            # Extract and check license/registration date
            date_str = (
                rec.get("תאריך_רישיון")
                or rec.get("תאריך_רישום")
                or rec.get("registration_date")
                or ""
            )

            is_recent = True
            if date_str:
                try:
                    d = datetime.fromisoformat(date_str.replace("Z", "+00:00"))
                    if d.tzinfo is None:
                        d = d.replace(tzinfo=timezone.utc)
                    is_recent = d >= cutoff
                except (ValueError, TypeError):
                    pass

            if not is_recent:
                continue

            address = rec.get("כתובת") or rec.get("address") or ""
            biz_type = rec.get("סוג_עסק") or rec.get("type") or ""

            new_licenses.append({
                "name": biz_name,
                "address": address,
                "city": city,
                "license_date": date_str,
                "type": biz_type,
                "alert": f"🆕 רישיון עסק חדש: {biz_name} ב{address or city}",
            })

        logger.info(
            f"[GovData] Found {len(new_licenses)} new licenses "
            f"for {business_type} in {city}"
        )
        return new_licenses

    # ------------------------------------------------------------------
    # DB-integrated scan
    # ------------------------------------------------------------------

    def scan_business(self, business_id: str, supabase) -> list[dict]:
        """Scan government data for a business and save alerts."""
        try:
            biz = (
                supabase.table("businesses")
                .select("industry, location")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if not biz.data:
                return []
        except Exception as e:
            logger.error(f"[GovData] DB error: {e}")
            return []

        industry = biz.data.get("industry", "")
        city = biz.data.get("location", "")

        licenses = self.get_business_licenses(city, industry)

        # Save as intelligence events
        for lic in licenses:
            try:
                supabase.table("intelligence_events").insert({
                    "business_id": business_id,
                    "event_type": "new_competitor_alert",
                    "title": lic["alert"],
                    "description": (
                        f"עסק חדש נרשם בתחום {industry} ב{city}: "
                        f"{lic['name']}. כתובת: {lic.get('address', 'לא ידוע')}. "
                        f"תאריך רישיון: {lic.get('license_date', 'לא ידוע')}."
                    ),
                    "severity": "high",
                    "source": "gov_data",
                    "is_read": False,
                    "metadata": json.dumps(lic, ensure_ascii=False, default=str),
                }).execute()
            except Exception as e:
                logger.debug(f"[GovData] Alert save error: {e}")

        return licenses


def get_gov_data_scanner() -> GovDataScanner:
    global _instance
    if _instance is None:
        _instance = GovDataScanner()
    return _instance
