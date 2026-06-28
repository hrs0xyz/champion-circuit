from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    APP_NAME: str = "Champion Circuit API"
    ENVIRONMENT: str = "local"
    SECRET_KEY: str = Field(default="change-me-before-production")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 #* 7  # 7 days
    DATABASE_URL: str = "sqlite:///./champion_circuit.db"
    BACKEND_CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    GOOGLE_CLIENT_ID: str = ""
    PUBLIC_BASE_URL: str = "http://127.0.0.1:8000"
    UPLOAD_DIR: str = "uploads"
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = ""
    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.BACKEND_CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
