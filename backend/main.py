"""
Quiet Eyes - FastAPI Backend

Main entry point for the business intelligence API.
Provides endpoints for business analysis and competitor monitoring.
"""

import os
import time
import logging
import threading
import asyncio
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
import anthropic
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from models import (
    AnalyzeBusinessRequest,
    AnalyzeBusinessResponse,
    ScanCompetitorRequest,
    ScanCompetitorResponse,
    ErrorResponse,
)
from services.ai_engine import (
    analyze_business_full,
    generate_competitor_card,
)
from services.scheduler import get_scheduler, JobType
from services.system_logger import get_system_logger
from services.credit_guard import check_and_deduct_credits, CreditCost

# =============================================================================
# CONFIGURATION
# =============================================================================

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Environment variables
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")


# =============================================================================
# GLOBAL RADAR — Autonomous Background Scheduler
# =============================================================================

class GlobalRadar:
    """
    Autonomous background scheduler that polls scheduler.get_due_jobs()
    every 60 seconds and dispatches by job_type.
    """

    def __init__(self):
        self.is_running = False
        self.poll_interval_seconds = 60
        self.last_run: dict[str, datetime] = {}
        self._thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()

    def start(self):
        """Start the background radar loop."""
        if self.is_running:
            return
        self.is_running = True
        self._stop_event.clear()
        self._thread = threading.Thread(target=self._radar_loop, daemon=True)
        self._thread.start()
        logger.info("[GlobalRadar] Started background scheduler")

    def stop(self):
        """Stop the background radar loop."""
        self.is_running = False
        self._stop_event.set()
        if self._thread:
            self._thread.join(timeout=10)
        logger.info("[GlobalRadar] Stopped background scheduler")

    def _radar_loop(self):
        """Main polling loop — runs in a background thread."""
        self._stop_event.wait(timeout=30)  # Initial delay
        self._ensure_all_default_jobs()
        while not self._stop_event.is_set():
            try:
                self._run_scheduled_jobs()
            except Exception as e:
                logger.error(f"[GlobalRadar] ERROR: {e}")
            # Beta feedback triggers — run once daily
            try:
                self._check_beta_triggers()
            except Exception as e:
                logger.debug(f"[GlobalRadar] Beta trigger check error: {e}")
            self._stop_event.wait(timeout=self.poll_interval_seconds)

    def _check_beta_triggers(self):
        """Run beta feedback triggers once per day."""
        now = datetime.now(timezone.utc)
        last = self.last_run.get("_beta_triggers")
        if last and (now - last).total_seconds() < 86400:
            return  # Already ran today
        try:
            from services.beta_scheduler import check_beta_feedback_triggers
            check_beta_feedback_triggers()
            self.last_run["_beta_triggers"] = now
        except ImportError:
            pass

    def _ensure_all_default_jobs(self):
        """Create default scheduled jobs for every active business."""
        try:
            from config import supabase
            scheduler = get_scheduler()
            businesses = supabase.table("businesses").select("id").execute()
            for biz in businesses.data or []:
                scheduler.ensure_default_jobs(biz["id"])
        except Exception as e:
            logger.debug(f"[GlobalRadar] ensure_all_default_jobs: {e}")

    def _run_scheduled_jobs(self):
        """Poll for due jobs and dispatch each one."""
        scheduler = get_scheduler()
        sys_logger = get_system_logger()
        due_jobs = scheduler.get_due_jobs()

        if not due_jobs:
            return

        # Map job types to their credit cost
        JOB_CREDIT_COST = {
            JobType.LEAD_SNIPE: CreditCost.LEAD_SNIPE,
            JobType.COMPETITOR_SCAN: CreditCost.COMPETITOR_SCAN,
            JobType.MARKET_DISCOVERY: CreditCost.MARKET_DISCOVERY,
            JobType.PRICE_CHECK: CreditCost.COMPETITOR_SCAN,
            JobType.WEEKLY_REPORT: CreditCost.PDF_REPORT,
            JobType.MASTER_INTEL_SCAN: CreditCost.INTEL_SCAN,
            JobType.WEEKLY_MEMORY_SNAPSHOT: CreditCost.MEMORY_SNAPSHOT,
            JobType.WEEKLY_PREDICTION: CreditCost.PREDICTION,
            JobType.MONTHLY_PATTERNS: CreditCost.PATTERN_DETECTION,
            # Phase 3: Automation Engine
            JobType.REVIEW_MONITOR: CreditCost.REVIEW_RESPONSE,
            JobType.COMPETITOR_ALERTS_AUTO: CreditCost.COMPETITOR_ALERT_AUTO,
            JobType.MORNING_BRIEFING: CreditCost.MORNING_BRIEFING_SEND,
            JobType.CAMPAIGN_TRIGGERS: CreditCost.CAMPAIGN_GENERATE,
            # Daily full scan (leads + competitors + market combined)
            JobType.DAILY_FULL_SCAN: CreditCost.LEAD_SNIPE + CreditCost.COMPETITOR_SCAN + CreditCost.MARKET_DISCOVERY,
            # Legacy aliases
            "intel_leads": CreditCost.LEAD_SNIPE,
            "intel_competitors": CreditCost.COMPETITOR_SCAN,
        }

        for job in due_jobs:
            job_id = job["id"]
            job_type = job.get("job_type", "")
            business_id = job.get("business_id", "")

            try:
                # Credit guard — check before running
                credit_cost = JOB_CREDIT_COST.get(job_type, 0)
                if credit_cost > 0:
                    if not check_and_deduct_credits(business_id, credit_cost, job_type):
                        logger.info(
                            f"[GlobalRadar] Skipping {job_type} for {business_id}: "
                            f"insufficient credits"
                        )
                        scheduler.mark_job_run(job_id)  # Still advance schedule
                        continue

                if job_type == JobType.LEAD_SNIPE:
                    from services.lead_sniper import get_lead_sniper
                    from config import supabase
                    sniper = get_lead_sniper()
                    report = sniper.sniping_mission(business_id, supabase)
                    logger.info(
                        f"[GlobalRadar] Lead snipe done for {business_id}: "
                        f"{report.leads_saved} saved"
                    )

                elif job_type == JobType.WEEKLY_REPORT:
                    self._handle_weekly_report(business_id)

                elif job_type == JobType.COMPETITOR_SCAN:
                    self._handle_competitor_scan(business_id)

                elif job_type == JobType.MARKET_DISCOVERY:
                    self._handle_market_discovery(business_id)

                elif job_type == JobType.PRICE_CHECK:
                    self._handle_competitor_scan(business_id)  # re-use scan logic

                # Legacy job type aliases
                elif job_type == "intel_leads":
                    from services.lead_sniper import get_lead_sniper
                    from config import supabase
                    sniper = get_lead_sniper()
                    report = sniper.sniping_mission(business_id, supabase)
                    logger.info(
                        f"[GlobalRadar] intel_leads (alias) done for {business_id}: "
                        f"{report.leads_saved} saved"
                    )

                elif job_type == "intel_competitors":
                    self._handle_competitor_scan(business_id)

                elif job_type == JobType.MASTER_INTEL_SCAN:
                    from services.intel_scanner import get_intel_scanner
                    from config import supabase
                    scanner = get_intel_scanner()
                    report = scanner.run_full_scan(business_id, supabase)
                    logger.info(
                        f"[GlobalRadar] Intel scan done for {business_id}: "
                        f"{report.total_events} events, {report.total_trends} trends"
                    )

                elif job_type == JobType.WEEKLY_MEMORY_SNAPSHOT:
                    from services.memory_engine import get_memory_engine
                    from config import supabase
                    get_memory_engine().snapshot_week(business_id, supabase)
                    logger.info(f"[GlobalRadar] Memory snapshot done for {business_id}")

                elif job_type == JobType.WEEKLY_PREDICTION:
                    from services.prediction_engine import get_prediction_engine
                    from config import supabase
                    get_prediction_engine().predict_next_week(business_id, supabase)
                    logger.info(f"[GlobalRadar] Prediction done for {business_id}")

                elif job_type == JobType.MONTHLY_PATTERNS:
                    from services.memory_engine import get_memory_engine
                    from config import supabase
                    get_memory_engine().detect_patterns(business_id, supabase)
                    logger.info(f"[GlobalRadar] Pattern detection done for {business_id}")

                # Phase 3: Automation Engine dispatch
                elif job_type == JobType.REVIEW_MONITOR:
                    from services.review_responder import get_review_responder
                    from config import supabase
                    count = get_review_responder().check_new_reviews(business_id, supabase)
                    logger.info(f"[GlobalRadar] Review monitor done for {business_id}: {count} processed")

                elif job_type == JobType.COMPETITOR_ALERTS_AUTO:
                    from services.competitor_alerts import get_competitor_alerts
                    from config import supabase
                    count = get_competitor_alerts().check_all_competitors(business_id, supabase)
                    logger.info(f"[GlobalRadar] Competitor alerts done for {business_id}: {count} alerts")

                elif job_type == JobType.MORNING_BRIEFING:
                    from services.morning_briefing import get_morning_briefing
                    from config import supabase
                    get_morning_briefing().send_morning_briefing(business_id, supabase)
                    logger.info(f"[GlobalRadar] Morning briefing done for {business_id}")

                elif job_type == JobType.CAMPAIGN_TRIGGERS:
                    from services.campaign_generator import get_campaign_generator
                    from config import supabase
                    count = get_campaign_generator().check_triggers(business_id, supabase)
                    logger.info(f"[GlobalRadar] Campaign triggers done for {business_id}: {count} campaigns")

                elif job_type == JobType.DAILY_FULL_SCAN:
                    self._handle_daily_full_scan(business_id)

                elif job_type in ("intel_trends", "audience_scan", "daily_summary"):
                    logger.debug(
                        f"[GlobalRadar] Skipping unimplemented job_type: {job_type}"
                    )

                else:
                    logger.warning(
                        f"[GlobalRadar] Unknown job_type: {job_type}"
                    )
                    continue

                scheduler.mark_job_run(job_id)
                self.last_run[business_id] = datetime.now(timezone.utc)

            except Exception as e:
                logger.error(f"[GlobalRadar] Job {job_id} ERROR: {e}")
                sys_logger.log_error(
                    source=f"global_radar.{job_type}",
                    message=f"Scheduled job failed: {job_type} for {business_id}",
                    exception=e,
                    details={"job_id": job_id, "business_id": business_id},
                    notify_admin=True,
                )

            time.sleep(2)  # small delay between jobs

    def _handle_weekly_report(self, business_id: str):
        """
        Generate weekly PDF report and send WhatsApp notification.

        1. Call generate_weekly_brief(business_id) to create PDF
        2. Look up workspace + notification preferences
        3. Send WhatsApp with cockpit link to /dashboard/reports
        4. Skip silently if WhatsApp not enabled

        All CRM/WhatsApp failures are logged to system_logs and
        the super-admin is notified.
        """
        sys_logger = get_system_logger()

        try:
            from config import supabase
        except ImportError:
            logger.debug("[GlobalRadar] Supabase unavailable for weekly report")
            return

        logger.info(f"[GlobalRadar] Generating weekly report for {business_id}")

        # Step 1: Generate the PDF brief
        try:
            from services.pdf_generator import generate_weekly_brief
            generate_weekly_brief(business_id)
            logger.info(f"[GlobalRadar] PDF generated for {business_id}")
        except ImportError:
            logger.debug("[GlobalRadar] PDF generator not available, skipping")
            return
        except Exception as e:
            sys_logger.log_error(
                source="pdf_generator",
                message=f"PDF generation failed for {business_id}",
                exception=e,
                details={"business_id": business_id},
                notify_admin=True,
            )
            return

        # Step 2: Look up workspace and notification preferences
        try:
            biz = (
                supabase.table("businesses")
                .select("workspace_id, business_name")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if not biz.data:
                return

            workspace_id = biz.data.get("workspace_id")
            biz_name = biz.data.get("business_name", "")

            if not workspace_id:
                return

            # Check notification preferences
            prefs = (
                supabase.table("notification_preferences")
                .select("whatsapp_enabled, whatsapp_phone")
                .eq("workspace_id", workspace_id)
                .maybe_single()
                .execute()
            )

            if not prefs.data or not prefs.data.get("whatsapp_enabled"):
                logger.debug(
                    f"[GlobalRadar] WhatsApp not enabled for workspace "
                    f"{workspace_id}, skipping notification"
                )
                return

            phone = prefs.data.get("whatsapp_phone", "")
            if not phone:
                return

            # Step 3: Send WhatsApp notification with link
            try:
                from services.whatsapp import send_whatsapp_message
                message = (
                    f"הדו\"ח השבועי של {biz_name} מוכן!\n"
                    f"צפה והורד: /dashboard/reports"
                )
                send_whatsapp_message(phone, message)
                logger.info(
                    f"[GlobalRadar] Weekly report WhatsApp sent to {phone[:6]}..."
                )
            except ImportError:
                logger.debug("[GlobalRadar] WhatsApp service not available")
            except Exception as e:
                sys_logger.log_error(
                    source="whatsapp",
                    message=f"WhatsApp weekly report alert failed for {business_id}",
                    exception=e,
                    details={
                        "business_id": business_id,
                        "workspace_id": workspace_id,
                        "phone_prefix": phone[:6] if phone else "",
                    },
                    notify_admin=True,
                )

        except Exception as e:
            sys_logger.log_error(
                source="weekly_report",
                message=f"Weekly report notification pipeline failed for {business_id}",
                exception=e,
                details={"business_id": business_id},
                notify_admin=True,
            )

    def _handle_competitor_scan(self, business_id: str):
        """
        Scan competitors for a business and log intelligence events.

        1. Look up business + competitors from DB
        2. For each competitor, use Tavily to search for recent activity
        3. Use AI to generate an intelligence event from findings
        4. Insert events into intelligence_events table
        """
        sys_logger = get_system_logger()
        try:
            from config import supabase
        except ImportError:
            return

        try:
            # Get business info
            biz = (
                supabase.table("businesses")
                .select("business_name, industry, location")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if not biz.data:
                return

            biz_name = biz.data.get("business_name", "")
            industry = biz.data.get("industry", "")
            location = biz.data.get("location", "")

            # Get competitors
            comp_result = (
                supabase.table("competitors")
                .select("name, website, google_rating")
                .eq("business_id", business_id)
                .limit(5)
                .execute()
            )
            competitors = comp_result.data or []
            if not competitors:
                logger.info(f"[GlobalRadar] No competitors for {business_id}, skipping scan")
                return

            import os
            import httpx
            tavily_key = os.getenv("TAVILY_API_KEY", "")

            events_to_insert = []
            for comp in competitors[:3]:  # Limit to 3 per run
                comp_name = comp.get("name", "")
                if not comp_name:
                    continue

                # Search for recent competitor activity
                findings = []
                if tavily_key:
                    try:
                        resp = httpx.post(
                            "https://api.tavily.com/search",
                            json={
                                "api_key": tavily_key,
                                "query": f"{comp_name} {location} {industry} חדשות עדכונים",
                                "max_results": 3,
                                "search_depth": "basic",
                            },
                            timeout=30.0,
                        )
                        if resp.status_code == 200:
                            findings = resp.json().get("results", [])
                    except Exception as e:
                        logger.debug(f"Tavily search error for {comp_name}: {e}")

                if findings:
                    # Create an intelligence event from findings
                    finding_text = findings[0].get("content", "")[:200]
                    events_to_insert.append({
                        "business_id": business_id,
                        "event_type": "competitor_change",
                        "title": f"עדכון מתחרה: {comp_name}",
                        "description": finding_text or f"זוהתה פעילות חדשה מצד {comp_name}",
                        "severity": "medium",
                        "source": "competitor_scan",
                        "is_read": False,
                    })

            if events_to_insert:
                supabase.table("intelligence_events").insert(events_to_insert).execute()
                logger.info(
                    f"[GlobalRadar] Competitor scan done for {business_id}: "
                    f"{len(events_to_insert)} events logged"
                )
            else:
                logger.info(f"[GlobalRadar] Competitor scan for {business_id}: no new findings")

        except Exception as e:
            logger.error(f"[GlobalRadar] Competitor scan error: {e}")
            sys_logger.log_error(
                source="global_radar.competitor_scan",
                message=f"Competitor scan failed for {business_id}",
                exception=e,
                details={"business_id": business_id},
            )

    def _handle_market_discovery(self, business_id: str):
        """
        Discover market opportunities for a business and log intelligence events.

        1. Look up business info
        2. Search for market opportunities via Tavily
        3. Log discoveries as intelligence events
        """
        sys_logger = get_system_logger()
        try:
            from config import supabase
        except ImportError:
            return

        try:
            # Get business info
            biz = (
                supabase.table("businesses")
                .select("business_name, industry, location")
                .eq("id", business_id)
                .single()
                .execute()
            )
            if not biz.data:
                return

            biz_name = biz.data.get("business_name", "")
            industry = biz.data.get("industry", "")
            location = biz.data.get("location", "")

            import os
            import httpx
            tavily_key = os.getenv("TAVILY_API_KEY", "")
            if not tavily_key:
                logger.debug("[GlobalRadar] No Tavily API key, skipping market discovery")
                return

            # Search for market opportunities
            queries = [
                f"{industry} {location} הזדמנויות עסקיות חדשות",
                f"{industry} ישראל טרנדים מגמות 2026",
            ]

            events_to_insert = []
            for query in queries:
                try:
                    resp = httpx.post(
                        "https://api.tavily.com/search",
                        json={
                            "api_key": tavily_key,
                            "query": query,
                            "max_results": 3,
                            "search_depth": "basic",
                        },
                        timeout=30.0,
                    )
                    if resp.status_code == 200:
                        for result in resp.json().get("results", [])[:2]:
                            content = result.get("content", "")[:200]
                            title = result.get("title", "")[:100]
                            if title:
                                events_to_insert.append({
                                    "business_id": business_id,
                                    "event_type": "lead_found",
                                    "title": f"הזדמנות שוק: {title}",
                                    "description": content,
                                    "severity": "low",
                                    "source": "market_discovery",
                                    "is_read": False,
                                })
                except Exception as e:
                    logger.debug(f"Tavily market discovery error: {e}")

            if events_to_insert:
                supabase.table("intelligence_events").insert(events_to_insert).execute()
                logger.info(
                    f"[GlobalRadar] Market discovery done for {business_id}: "
                    f"{len(events_to_insert)} opportunities found"
                )
            else:
                logger.info(f"[GlobalRadar] Market discovery for {business_id}: no new findings")

        except Exception as e:
            logger.error(f"[GlobalRadar] Market discovery error: {e}")
            sys_logger.log_error(
                source="global_radar.market_discovery",
                message=f"Market discovery failed for {business_id}",
                exception=e,
                details={"business_id": business_id},
            )

    def _handle_daily_full_scan(self, business_id: str):
        """
        Daily comprehensive scan: leads + competitors + market discovery.
        Runs at 6am UTC (8am Israel) to ensure fresh data every morning.
        """
        logger.info(f"[GlobalRadar] Starting daily full scan for {business_id}")

        # 1. Lead sniping
        try:
            from services.lead_sniper import get_lead_sniper
            from config import supabase
            sniper = get_lead_sniper()
            report = sniper.sniping_mission(business_id, supabase)
            logger.info(
                f"[GlobalRadar] DFS lead snipe: {report.leads_saved} saved for {business_id}"
            )
        except Exception as e:
            logger.error(f"[GlobalRadar] DFS lead snipe error: {e}")

        time.sleep(2)

        # 2. Competitor scan
        try:
            self._handle_competitor_scan(business_id)
        except Exception as e:
            logger.error(f"[GlobalRadar] DFS competitor scan error: {e}")

        time.sleep(2)

        # 3. Market discovery
        try:
            self._handle_market_discovery(business_id)
        except Exception as e:
            logger.error(f"[GlobalRadar] DFS market discovery error: {e}")

        logger.info(f"[GlobalRadar] Daily full scan complete for {business_id}")

    def trigger_immediate(self, business_id: str) -> dict:
        """Run market_discovery and lead_sniping immediately for a business."""
        results: dict = {"lead_sniping": None}
        try:
            from services.lead_sniper import get_lead_sniper
            from config import supabase
            sniper = get_lead_sniper()
            report = sniper.sniping_mission(business_id, supabase)
            results["lead_sniping"] = {
                "leads_found": report.leads_found,
                "leads_saved": report.leads_saved,
            }
        except Exception as e:
            results["lead_sniping"] = {"error": str(e)}
        return results


# Singleton instances
global_radar = GlobalRadar()


# =============================================================================
# APPLICATION LIFECYCLE
# =============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifecycle manager.
    Initializes resources on startup, cleans up on shutdown.
    """
    # Startup
    logger.info("Starting Quiet Eyes API...")

    if not os.getenv("ANTHROPIC_API_KEY"):
        logger.warning("ANTHROPIC_API_KEY not set - AI features will be limited")
    else:
        logger.info("Claude AI client ready")

    # Start background scheduler
    global_radar.start()

    yield

    # Shutdown
    global_radar.stop()
    logger.info("Shutting down Quiet Eyes API...")


# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(
    title="Quiet Eyes API",
    description="""
    Business Intelligence API for Israeli SMBs.

    ## Features
    - **Business Analysis**: Classify businesses and generate personalized insights
    - **Competitor Monitoring**: Scan competitors and generate actionable alerts
    - **AI-Powered**: Uses Claude claude-sonnet-4-6 for intelligent analysis

    ## Archetypes
    - **Visual**: Image-driven businesses (restaurants, salons, fashion)
    - **Expert**: Professional services (lawyers, doctors, consultants)
    - **Field**: Service area businesses (deliveries, repairs)
    - **Merchant**: Retail and sales (shops, e-commerce)
    """,
    version="1.0.0",
    lifespan=lifespan,
    responses={
        500: {"model": ErrorResponse, "description": "Internal Server Error"}
    }
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware — origins loaded from CORS_ORIGINS env var
from config import get_settings as _get_settings
_cors_origins = _get_settings().cors_origins_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from routers.admin import router as admin_router
from routers.crm import router as crm_router
from routers.auditor import router as auditor_router
from routers.business import router as business_router
from routers.knowledge import router as knowledge_router
from routers.jobs import router as jobs_router
from routers.onboard import router as onboard_router
from routers.billing import router as billing_router
from routers.workspace import router as workspace_router
from routers.dashboard import router as dashboard_router
from routers.prompts import router as prompts_router
from routers.cockpit import router as cockpit_router
from routers.intelligence import router as intelligence_router
from routers.audience import router as audience_router
from routers.competitors_api import router as competitors_api_router
from routers.leads_api import router as leads_api_router
from routers.expert import router as expert_router
from routers.chat import router as chat_router
from routers.radar import router as radar_router
from routers.misc_api import router as misc_api_router
from routers.notifications import router as notifications_router
from routers.intel_scanner_api import router as intel_scanner_router
from routers.automations import router as automations_router
from routers.whatsapp_webhook import router as whatsapp_webhook_router
from routers.waitlist import router as waitlist_router
from routers.feedback import router as feedback_router
from routers.marketing_intel import router as marketing_intel_router
app.include_router(admin_router)
app.include_router(crm_router)
app.include_router(auditor_router)
app.include_router(business_router)
app.include_router(knowledge_router)
app.include_router(jobs_router)
app.include_router(onboard_router)
app.include_router(billing_router)
app.include_router(workspace_router)
app.include_router(dashboard_router)
app.include_router(prompts_router)
app.include_router(cockpit_router)
app.include_router(intelligence_router)
app.include_router(audience_router)
app.include_router(competitors_api_router)
app.include_router(leads_api_router)
app.include_router(expert_router)
app.include_router(chat_router)
app.include_router(radar_router)
app.include_router(misc_api_router)
app.include_router(notifications_router)
app.include_router(intel_scanner_router)
app.include_router(automations_router)
app.include_router(whatsapp_webhook_router)
app.include_router(waitlist_router)
app.include_router(feedback_router)
app.include_router(marketing_intel_router)


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/health", tags=["System"])
@limiter.limit("100/minute")
async def health_check(request: Request):
    """
    Health check endpoint for monitoring and load balancers.
    """
    return {
        "status": "healthy",
        "service": "quiet-eyes-api",
        "version": "1.0.0",
        "ai_available": os.getenv("ANTHROPIC_API_KEY") is not None
    }


# =============================================================================
# BUSINESS ANALYSIS ENDPOINT
# =============================================================================

@app.post(
    "/analyze-business",
    response_model=AnalyzeBusinessResponse,
    tags=["Business Analysis"],
    summary="Analyze a business and generate insights",
    responses={
        200: {"description": "Business analyzed successfully"},
        400: {"model": ErrorResponse, "description": "Invalid request"},
        503: {"model": ErrorResponse, "description": "AI service unavailable"}
    }
)
@limiter.limit("10/minute")
async def analyze_business(
    http_request: Request,
    request: AnalyzeBusinessRequest,
):
    """
    Analyze a business description and generate personalized insights.

    This endpoint:
    1. Uses AI to classify the business into an archetype (Visual/Expert/Field/Merchant)
    2. Generates 3 initial insight cards tailored to the business type
    3. Returns a complete business profile with health score and recommendations

    ## Example Request
    ```json
    {
        "description": "I own a pizza place in Hadera"
    }
    ```

    ## Example Response
    Returns a business profile with archetype "Merchant" and pizza-specific insights.
    """
    logger.info(f"Analyzing business: {request.description[:50]}...")

    try:
        # Perform full business analysis
        profile, cards = await analyze_business_full(request.description)

        logger.info(f"Analysis complete: {profile.archetype} - {profile.name_hebrew}")

        return AnalyzeBusinessResponse(
            profile=profile,
            cards=cards,
            success=True,
            message=f"זיהינו את העסק שלך כ{profile.name_hebrew}"
        )

    except anthropic.APIError as e:
        logger.error(f"Claude AI service error: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Claude AI service error: {str(e)}"
        )
    except ValueError as e:
        logger.error(f"Validation error: {e}")
        raise HTTPException(
            status_code=400,
            detail=f"Invalid input: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error during analysis: {e}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during analysis"
        )


# =============================================================================
# COMPETITOR SCAN ENDPOINT
# =============================================================================

# Simulated scan results for MVP (in production, this would come from actual scraping)
SIMULATED_FINDINGS = [
    "Found negative review: 'Service was slow, waited 45 minutes for delivery'",
    "Competitor raised prices by 15% on main menu items",
    "Competitor launched new promotional campaign with 30% discount",
    "Competitor received 5-star review praising fast service",
    "Competitor added new menu items / services",
    "Competitor changed business hours - now open until midnight",
    "Competitor's Google rating dropped from 4.5 to 4.2 stars",
    "Competitor announced expansion to new location",
]


@app.post(
    "/scan-competitor",
    response_model=ScanCompetitorResponse,
    tags=["Competitor Monitoring"],
    summary="Scan a competitor and generate alert",
    responses={
        200: {"description": "Competitor scanned successfully"},
        503: {"model": ErrorResponse, "description": "AI service unavailable"}
    }
)
@limiter.limit("10/minute")
async def scan_competitor(
    request: Request,
    payload: ScanCompetitorRequest,
):
    """
    Scan a competitor and generate an actionable alert card.

    For MVP, this simulates a competitor scan by:
    1. Selecting a random "finding" (in production: actual web scraping)
    2. Using AI to generate an alert card based on the finding
    3. Returning the alert with actionable recommendations

    ## Example Request
    ```json
    {
        "competitor_name": "פיצה נאפולי",
        "competitor_type": "pizzeria"
    }
    ```

    ## Example Response
    Returns an alert card with competitive intelligence and action items.
    """
    logger.info(f"Scanning competitor: {payload.competitor_name}")

    try:
        # Simulate a scan finding (MVP)
        import random
        finding = random.choice(SIMULATED_FINDINGS)

        logger.info(f"Simulated finding: {finding}")

        # Generate alert card using AI
        card = await generate_competitor_card(
            competitor_name=payload.competitor_name,
            competitor_type=payload.competitor_type,
            finding=finding
        )

        return ScanCompetitorResponse(
            card=card,
            scan_summary=f"סריקת {payload.competitor_name} הושלמה. נמצאו תובנות חדשות.",
            success=True
        )

    except anthropic.APIError as e:
        logger.error(f"Claude AI service error: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"Claude AI service error: {str(e)}"
        )
    except Exception as e:
        logger.exception(f"Unexpected error during scan: {e}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred during competitor scan"
        )


# =============================================================================
# ROOT REDIRECT
# =============================================================================

@app.get("/", include_in_schema=False)
@limiter.limit("100/minute")
async def root(request: Request):
    """Redirect root to API documentation."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    settings = _get_settings()
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level="info"
    )
