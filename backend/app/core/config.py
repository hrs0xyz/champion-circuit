import logging
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Champion Circuit API"
    ENVIRONMENT: str = "local"
    SECRET_KEY: str = Field(default="change-me-before-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day
    DATABASE_URL: str = "sqlite:///./champion_circuit.db"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    GOOGLE_CLIENT_ID: str = ""
    PUBLIC_BASE_URL: str = "http://127.0.0.1:8000"

    # AWS SES Configuration
    AWS_REGION: str = Field(default="ap-south-1")
    AWS_ACCESS_KEY_ID: str = Field(default="")
    AWS_SECRET_ACCESS_KEY: str = Field(default="")
    SES_FROM_EMAIL: str = Field(default="official@championcircuit.com")
    SES_FROM_NAME: str = Field(default="Champion Circuit")

    # Legacy SMTP (deprecated - will be removed)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""

    # Payment & Cloud Services
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    @field_validator("AWS_REGION")
    @classmethod
    def validate_aws_region(cls, v: str) -> str:
        """Validate AWS region format."""
        if v and not v.startswith(("us-", "eu-", "ap-", "sa-", "ca-", "me-", "af-")):
            logger.warning(f"AWS_REGION '{v}' may not be a valid AWS region")
        return v

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_production(self) -> bool:
        """Check if running in production environment."""
        return self.ENVIRONMENT.lower() in ("production", "prod")

    @property
    def is_development(self) -> bool:
        """Check if running in development environment."""
        return self.ENVIRONMENT.lower() in ("development", "dev", "local")

    @property
    def ses_configured(self) -> bool:
        """Check if AWS SES is properly configured."""
        # Allow implicit credentials (IAM roles) OR explicit credentials
        has_explicit_creds = bool(self.AWS_ACCESS_KEY_ID and self.AWS_SECRET_ACCESS_KEY)
        has_required_config = bool(self.AWS_REGION and self.SES_FROM_EMAIL)
        return has_required_config and (has_explicit_creds or self.is_production)

    def validate_ses_config(self) -> None:
        """
        Validate SES configuration on startup.
        Raises ValueError if required SES settings are missing in production.
        """
        if not self.AWS_REGION:
            raise ValueError("AWS_REGION is required for email service")

        if not self.SES_FROM_EMAIL:
            raise ValueError("SES_FROM_EMAIL is required for email service")

        if not self.SES_FROM_NAME:
            logger.warning("SES_FROM_NAME not set, using default: 'Champion Circuit'")

        # In production or when explicit credentials are expected
        if self.is_production:
            if not self.AWS_ACCESS_KEY_ID and not self.AWS_SECRET_ACCESS_KEY:
                logger.info(
                    "AWS credentials not found in environment. "
                    "Assuming IAM role-based authentication (ECS/EC2)."
                )
            elif self.AWS_ACCESS_KEY_ID and not self.AWS_SECRET_ACCESS_KEY:
                raise ValueError("AWS_ACCESS_KEY_ID set but AWS_SECRET_ACCESS_KEY is missing")
            elif self.AWS_SECRET_ACCESS_KEY and not self.AWS_ACCESS_KEY_ID:
                raise ValueError("AWS_SECRET_ACCESS_KEY set but AWS_ACCESS_KEY_ID is missing")

        # Development mode warnings
        if self.is_development:
            if not self.ses_configured:
                logger.warning(
                    "AWS SES not fully configured. Emails will be logged to console only. "
                    "Set AWS_REGION, SES_FROM_EMAIL, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY "
                    "in your .env file to send real emails."
                )


settings = Settings()


# Validate SES configuration on module import (application startup)
try:
    settings.validate_ses_config()
except ValueError as e:
    if settings.is_production:
        # Fail fast in production
        raise RuntimeError(f"SES configuration error: {e}") from e
    else:
        # Warn in development
        logger.warning(f"SES configuration incomplete: {e}")
