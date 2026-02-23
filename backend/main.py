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

from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, OpenAIError

from models import (
    AnalyzeBusinessRequest,
    AnalyzeBusinessResponse,
    ScanCompetitorRequest,
    ScanCompetitorResponse,
    ErrorResponse,
)
from services.ai_engine import (
    get_openai_client,
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
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

# Global OpenAI client (initialized on startup)
openai_client: Optional[OpenAI] = None


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
            self._stop_event.wait(timeout=self.poll_interval_seconds)

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

                elif job_type in (JobType.COMPETITOR_SCAN, JobType.MARKET_DISCOVERY):
                    logger.info(
                        f"[GlobalRadar] {job_type} for {business_id} (stub)"
                    )

                elif job_type == JobType.PRICE_CHECK:
                    logger.info(
                        f"[GlobalRadar] price_check for {business_id} (stub)"
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
    global openai_client

    # Startup
    logger.info("Starting Quiet Eyes API...")

    if not OPENAI_API_KEY:
        logger.warning("OPENAI_API_KEY not set - AI features will be limited")
    else:
        openai_client = get_openai_client(OPENAI_API_KEY)
        logger.info("OpenAI client initialized")

    # Start background scheduler
    global_radar.start()

    yield

    # Shutdown
    global_radar.stop()
    logger.info("Shutting down Quiet Eyes API...")


# =============================================================================
# FASTAPI APPLICATION
# =============================================================================

app = FastAPI(
    title="Quiet Eyes API",
    description="""
    Business Intelligence API for Israeli SMBs.

    ## Features
    - **Business Analysis**: Classify businesses and generate personalized insights
    - **Competitor Monitoring**: Scan competitors and generate actionable alerts
    - **AI-Powered**: Uses GPT-4o-mini for intelligent analysis

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

# CORS middleware for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite default
        "http://localhost:5174",  # Vite alternate
        "http://localhost:3000",  # React default
        # Add production domains here
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
from routers.admin import router as admin_router
from routers.crm import router as crm_router
from routers.auditor import router as auditor_router
app.include_router(admin_router)
app.include_router(crm_router)
app.include_router(auditor_router)


# =============================================================================
# DEPENDENCIES
# =============================================================================

def get_ai_client() -> OpenAI:
    """
    Dependency that provides the OpenAI client.

    Raises:
        HTTPException: If OpenAI client is not available
    """
    if openai_client is None:
        raise HTTPException(
            status_code=503,
            detail="AI service unavailable. Please configure OPENAI_API_KEY."
        )
    return openai_client


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.get("/health", tags=["System"])
async def health_check():
    """
    Health check endpoint for monitoring and load balancers.
    """
    return {
        "status": "healthy",
        "service": "quiet-eyes-api",
        "version": "1.0.0",
        "ai_available": openai_client is not None
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
async def analyze_business(
    request: AnalyzeBusinessRequest,
    client: OpenAI = Depends(get_ai_client)
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
        profile, cards = await analyze_business_full(client, request.description)

        logger.info(f"Analysis complete: {profile.archetype} - {profile.name_hebrew}")

        return AnalyzeBusinessResponse(
            profile=profile,
            cards=cards,
            success=True,
            message=f"זיהינו את העסק שלך כ{profile.name_hebrew}"
        )

    except OpenAIError as e:
        logger.error(f"OpenAI API error: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"AI service error: {str(e)}"
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
async def scan_competitor(
    request: ScanCompetitorRequest,
    client: OpenAI = Depends(get_ai_client)
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
    logger.info(f"Scanning competitor: {request.competitor_name}")

    try:
        # Simulate a scan finding (MVP)
        import random
        finding = random.choice(SIMULATED_FINDINGS)

        logger.info(f"Simulated finding: {finding}")

        # Generate alert card using AI
        card = await generate_competitor_card(
            client=client,
            competitor_name=request.competitor_name,
            competitor_type=request.competitor_type,
            finding=finding
        )

        return ScanCompetitorResponse(
            card=card,
            scan_summary=f"סריקת {request.competitor_name} הושלמה. נמצאו תובנות חדשות.",
            success=True
        )

    except OpenAIError as e:
        logger.error(f"OpenAI API error: {e}")
        raise HTTPException(
            status_code=503,
            detail=f"AI service error: {str(e)}"
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
async def root():
    """Redirect root to API documentation."""
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/docs")


# =============================================================================
# MAIN ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
