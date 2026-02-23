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
    """
    Application settings loaded from environment variables.

    Attributes:
        openai_api_key: OpenAI API key for AI features
        supabase_url: Supabase project URL
        supabase_key: Supabase anonymous/service key
        host: Server host address
        port: Server port number
        debug: Enable debug mode
    """

    # OpenAI Configuration
    openai_api_key: Optional[str] = Field(
        default=None,
        description="OpenAI API key for GPT-4o-mini"
    )

    # Supabase Configuration
    supabase_url: Optional[str] = Field(
        default=None,
        description="Supabase project URL"
    )
    supabase_key: Optional[str] = Field(
        default=None,
        description="Supabase anon/service key"
    )

    # Server Configuration
    host: str = Field(
        default="0.0.0.0",
        description="Server host"
    )
    port: int = Field(
        default=8000,
        description="Server port"
    )
    debug: bool = Field(
        default=False,
        description="Enable debug mode"
    )

    # Twilio / WhatsApp Configuration
    twilio_account_sid: Optional[str] = Field(
        default=None,
        description="Twilio Account SID"
    )
    twilio_auth_token: Optional[str] = Field(
        default=None,
        description="Twilio Auth Token"
    )
    twilio_whatsapp_from: Optional[str] = Field(
        default=None,
        description="Twilio WhatsApp sender number (e.g. whatsapp:+14155238886)"
    )

    # Tavily Search API
    tavily_api_key: Optional[str] = Field(
        default=None,
        description="Tavily API key for web search"
    )

    # CORS Origins (comma-separated in env)
    cors_origins: str = Field(
        default="http://localhost:5173,http://localhost:5174,http://localhost:3000",
        description="Allowed CORS origins"
    )

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    @property
    def cors_origins_list(self) -> list[str]:
        """Parse CORS origins from comma-separated string."""
        return [origin.strip() for origin in self.cors_origins.split(",")]

    @property
    def is_ai_available(self) -> bool:
        """Check if AI features are available."""
        return self.openai_api_key is not None

    @property
    def is_db_available(self) -> bool:
        """Check if database is configured."""
        return self.supabase_url is not None and self.supabase_key is not None


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
