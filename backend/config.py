"""
Configuration management for Quiet Eyes backend.

Uses pydantic-settings when available, falls back to os.environ.
"""

import os
from functools import lru_cache
from typing import Optional

# Load .env for local development only
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Try pydantic-settings; fall back to plain os.environ if deps missing
try:
    from pydantic import Field
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        """Application settings loaded from environment variables."""

        # ── Core (required) ──
        anthropic_api_key: Optional[str] = Field(default=None)
        supabase_url: Optional[str] = Field(default=None)
        supabase_key: Optional[str] = Field(default=None)
        supabase_service_role_key: Optional[str] = Field(default=None)

        # ── Server ──
        host: str = Field(default="0.0.0.0")
        port: int = Field(default=8015)
        debug: bool = Field(default=False)
        app_url: str = Field(default="http://localhost:3000")
        node_env: str = Field(default="development")

        # ── Google Places + Geocoding ──
        google_places_api_key: Optional[str] = Field(default=None)
        google_api_key: Optional[str] = Field(default=None)

        # ── Apify (Facebook scraping) ──
        apify_api_token: Optional[str] = Field(default=None)
        apify_api_key: Optional[str] = Field(default=None)  # alias

        # ── SerpAPI (Google Trends + Search) ──
        serpapi_key: Optional[str] = Field(default=None)
        serpapi_api_key: Optional[str] = Field(default=None)  # alias

        # ── Tavily (news + trends) ──
        tavily_api_key: Optional[str] = Field(default=None)

        # ── WhatsApp — Twilio (legacy) ──
        twilio_account_sid: Optional[str] = Field(default=None)
        twilio_auth_token: Optional[str] = Field(default=None)
        twilio_whatsapp_from: Optional[str] = Field(default=None)

        # ── WhatsApp — Green API (primary) ──
        green_api_instance_id: Optional[str] = Field(default=None)
        green_api_token: Optional[str] = Field(default=None)

        # ── Admin ──
        admin_phone: Optional[str] = Field(default=None)
        admin_email: Optional[str] = Field(default=None)
        super_admin_uid: Optional[str] = Field(default=None)

        # ── Stripe ──
        stripe_secret_key: Optional[str] = Field(default=None)

        # ── CORS ──
        cors_origins: str = Field(
            default="http://localhost:5173,http://localhost:5174,http://localhost:3000",
        )

        model_config = SettingsConfigDict(
            env_file=".env" if os.path.exists(".env") else None,
            env_file_encoding="utf-8",
            case_sensitive=False,
            extra="ignore",
        )

        @property
        def cors_origins_list(self) -> list[str]:
            return [origin.strip() for origin in self.cors_origins.split(",")]

        @property
        def is_ai_available(self) -> bool:
            return self.anthropic_api_key is not None

        @property
        def is_db_available(self) -> bool:
            return self.supabase_url is not None and self.supabase_key is not None

        @property
        def google_key(self) -> str | None:
            return self.google_places_api_key or self.google_api_key

        @property
        def apify_key(self) -> str | None:
            return self.apify_api_token or self.apify_api_key

        @property
        def serp_key(self) -> str | None:
            return self.serpapi_key or self.serpapi_api_key

        @property
        def is_whatsapp_available(self) -> bool:
            green = bool(self.green_api_instance_id and self.green_api_token)
            twilio = bool(self.twilio_account_sid and self.twilio_auth_token)
            return green or twilio

        def validate_required(self) -> list[str]:
            """Return list of missing critical env vars. Empty = all good."""
            missing = []
            if not self.anthropic_api_key:
                missing.append("ANTHROPIC_API_KEY")
            if not self.supabase_url:
                missing.append("SUPABASE_URL")
            if not self.supabase_key:
                missing.append("SUPABASE_KEY")
            return missing

        def validate_all(self) -> list[str]:
            """Return list of ALL missing env vars (critical + optional)."""
            missing = self.validate_required()
            if not self.google_key:
                missing.append("GOOGLE_PLACES_API_KEY")
            if not self.apify_key:
                missing.append("APIFY_API_TOKEN")
            if not self.serp_key:
                missing.append("SERPAPI_KEY")
            if not self.tavily_api_key:
                missing.append("TAVILY_API_KEY")
            if not self.is_whatsapp_available:
                missing.append("GREEN_API_INSTANCE_ID + GREEN_API_TOKEN (or Twilio)")
            return missing

        def print_status(self):
            """Log the configuration status on startup."""
            import logging
            log = logging.getLogger("config")
            log.info("=== Quieteyes Config ===")
            log.info(f"  AI (Claude):      {'Y' if self.is_ai_available else 'N'}")
            log.info(f"  Database:         {'Y' if self.is_db_available else 'N'}")
            log.info(f"  Google Places:    {'Y' if self.google_key else 'N'}")
            log.info(f"  Apify:            {'Y' if self.apify_key else 'N'}")
            log.info(f"  SerpAPI:          {'Y' if self.serp_key else 'N'}")
            log.info(f"  Tavily:           {'Y' if self.tavily_api_key else 'N'}")
            log.info(f"  WhatsApp:         {'Y' if self.is_whatsapp_available else 'N'}")
            missing = self.validate_required()
            if missing:
                log.warning(f"  MISSING CRITICAL: {', '.join(missing)}")

except ImportError:
    # Fallback: pydantic-settings not available, read from os.environ
    class Settings:
        """Fallback settings using os.environ directly."""

        def __init__(self):
            self.anthropic_api_key = os.environ.get("ANTHROPIC_API_KEY")
            self.supabase_url = os.environ.get("SUPABASE_URL")
            self.supabase_key = os.environ.get("SUPABASE_KEY")
            self.supabase_service_role_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
            self.host = os.environ.get("HOST", "0.0.0.0")
            self.port = int(os.environ.get("PORT", "8015"))
            self.debug = os.environ.get("DEBUG", "").lower() in ("true", "1")
            self.app_url = os.environ.get("APP_URL", "http://localhost:3000")
            self.node_env = os.environ.get("NODE_ENV", "development")
            self.google_places_api_key = os.environ.get("GOOGLE_PLACES_API_KEY")
            self.google_api_key = os.environ.get("GOOGLE_API_KEY")
            self.apify_api_token = os.environ.get("APIFY_API_TOKEN")
            self.apify_api_key = os.environ.get("APIFY_API_KEY")
            self.serpapi_key = os.environ.get("SERPAPI_KEY")
            self.serpapi_api_key = os.environ.get("SERPAPI_API_KEY")
            self.tavily_api_key = os.environ.get("TAVILY_API_KEY")
            self.twilio_account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
            self.twilio_auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
            self.twilio_whatsapp_from = os.environ.get("TWILIO_WHATSAPP_FROM")
            self.green_api_instance_id = os.environ.get("GREEN_API_INSTANCE_ID")
            self.green_api_token = os.environ.get("GREEN_API_TOKEN")
            self.admin_phone = os.environ.get("ADMIN_PHONE")
            self.admin_email = os.environ.get("ADMIN_EMAIL")
            self.super_admin_uid = os.environ.get("SUPER_ADMIN_UID")
            self.stripe_secret_key = os.environ.get("STRIPE_SECRET_KEY")
            self.cors_origins = os.environ.get(
                "CORS_ORIGINS",
                "http://localhost:5173,http://localhost:5174,http://localhost:3000",
            )

        @property
        def cors_origins_list(self) -> list[str]:
            return [origin.strip() for origin in self.cors_origins.split(",")]

        @property
        def is_ai_available(self) -> bool:
            return self.anthropic_api_key is not None

        @property
        def is_db_available(self) -> bool:
            return self.supabase_url is not None and self.supabase_key is not None

        @property
        def google_key(self):
            return self.google_places_api_key or self.google_api_key

        @property
        def apify_key(self):
            return self.apify_api_token or self.apify_api_key

        @property
        def serp_key(self):
            return self.serpapi_key or self.serpapi_api_key

        @property
        def is_whatsapp_available(self) -> bool:
            green = bool(self.green_api_instance_id and self.green_api_token)
            twilio = bool(self.twilio_account_sid and self.twilio_auth_token)
            return green or twilio

        def validate_required(self) -> list[str]:
            missing = []
            if not self.anthropic_api_key:
                missing.append("ANTHROPIC_API_KEY")
            if not self.supabase_url:
                missing.append("SUPABASE_URL")
            if not self.supabase_key:
                missing.append("SUPABASE_KEY")
            return missing

        def validate_all(self) -> list[str]:
            missing = self.validate_required()
            if not self.google_key:
                missing.append("GOOGLE_PLACES_API_KEY")
            if not self.apify_key:
                missing.append("APIFY_API_TOKEN")
            if not self.serp_key:
                missing.append("SERPAPI_KEY")
            if not self.tavily_api_key:
                missing.append("TAVILY_API_KEY")
            if not self.is_whatsapp_available:
                missing.append("GREEN_API_INSTANCE_ID + GREEN_API_TOKEN (or Twilio)")
            return missing

        def print_status(self):
            import logging
            log = logging.getLogger("config")
            log.info("=== Quieteyes Config (fallback) ===")
            log.info(f"  AI (Claude):      {'Y' if self.is_ai_available else 'N'}")
            log.info(f"  Database:         {'Y' if self.is_db_available else 'N'}")
            missing = self.validate_required()
            if missing:
                log.warning(f"  MISSING CRITICAL: {', '.join(missing)}")


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# =============================================================================
# SUPABASE CLIENT SINGLETON
# =============================================================================

_settings = get_settings()
supabase = None

if _settings.supabase_url and _settings.supabase_key:
    try:
        from supabase import create_client
        supabase = create_client(_settings.supabase_url, _settings.supabase_key)
    except Exception:
        pass
