from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/health/ses")
def health_ses():
    """Check SES email configuration - useful for debugging."""
    from app.core.config import settings
    return {
        "ses_configured": settings.ses_configured,
        "aws_region": settings.AWS_REGION or None,
        "ses_from_email": settings.SES_FROM_EMAIL or None,
        "has_access_key": bool(settings.AWS_ACCESS_KEY_ID),
        "has_secret_key": bool(settings.AWS_SECRET_ACCESS_KEY),
        "environment": settings.ENVIRONMENT,
        "is_production": settings.is_production,
    }
