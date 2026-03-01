"""
Configuration management for Quiet Eyes backend.

Uses pydantic-settings for type-safe environment variable loading.
"""

import os
from functools import lru_cache
from typing import Optional

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
        env_file=".env",
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
        log.info("═══ Quieteyes Config ═══")
        log.info(f"  AI (Claude):      {'✓' if self.is_ai_available else '✗'}")
        log.info(f"  Database:         {'✓' if self.is_db_available else '✗'}")
        log.info(f"  Google Places:    {'✓' if self.google_key else '✗'}")
        log.info(f"  Apify:            {'✓' if self.apify_key else '✗'}")
        log.info(f"  SerpAPI:          {'✓' if self.serp_key else '✗'}")
        log.info(f"  Tavily:           {'✓' if self.tavily_api_key else '✗'}")
        log.info(f"  WhatsApp:         {'✓' if self.is_whatsapp_available else '✗'}")
        missing = self.validate_required()
        if missing:
            log.warning(f"  MISSING CRITICAL: {', '.join(missing)}")


@lru_cache
def get_settings() -> Settings:
    """
    Get cached settings instance.

    Uses lru_cache to ensure settings are only loaded once.
    """
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
