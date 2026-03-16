import logging

from pydantic_settings import BaseSettings

logger = logging.getLogger("quieteyes.config")


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://quieteyes:quieteyes@postgres:5432/quieteyes"
    REDIS_URL: str = "redis://redis:6379/0"
    JWT_SECRET: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    MIN_PASSWORD_LENGTH: int = 8
    TAVILY_API_KEY: str = ""
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    ADMIN_EMAILS: str = ""  # comma-separated list of admin emails
    RATE_LIMIT_AUTH: str = "10/minute"
    RATE_LIMIT_DEFAULT: str = "60/minute"
    CORS_ORIGINS: str = "http://localhost:3000"  # comma-separated allowed origins

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()

# Startup security warnings
if settings.JWT_SECRET == "change-me-in-production":
    logger.warning(
        "⚠️  JWT_SECRET is using the default value. "
        "Set a strong, unique JWT_SECRET in production!"
    )
