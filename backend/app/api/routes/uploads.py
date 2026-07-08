from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.services.cloudinary_service import upload_image
from app.services.venue import add_venue_cover_photo, get_user_venue, set_venue_logo_url


router = APIRouter()

ALLOWED_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_BYTES = 3 * 1024 * 1024


@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a JPG, PNG, or WEBP image")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be 3MB or smaller")

    ext = ALLOWED_TYPES[file.content_type]

    result = upload_image(
        data,
        folder="champion-circuit/avatars",
    )

    url = result
    current_user.avatar_url = url
    db.commit()

    return {"url": url}


@router.post("/news-image")
async def upload_news_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Upload an image for use in a news article (cover or inline). Admin only."""
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a JPG, PNG, or WEBP image")

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be 3MB or smaller")

    url = upload_image(data, folder="champion-circuit/news")
    return {"url": url}


@router.post("/venue-logo")
async def upload_venue_logo(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    """Upload a logo for the current user's venue. Venue owners only."""
    if not current_user.is_venue_owner and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Venue owner access required")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a JPG, PNG, or WEBP image")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be 3MB or smaller")

    venue = get_user_venue(db, current_user.id, include_inactive=True)
    if not venue and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No venue found for this account")

    url = upload_image(data, folder="champion-circuit/venue-logos")

    if venue:
        set_venue_logo_url(db, venue, url)

    return {"url": url}


@router.post("/venue-cover")
async def upload_venue_cover(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Upload a cover photo for the current user's venue (max 3). Venue owners only."""
    if not current_user.is_venue_owner and not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Venue owner access required")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Upload a JPG, PNG, or WEBP image")
    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be 3MB or smaller")

    venue = get_user_venue(db, current_user.id, include_inactive=True)
    if not venue:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No venue found for this account")

    url = upload_image(data, folder="champion-circuit/venue-covers")

    try:
        photo = add_venue_cover_photo(db, venue.id, url)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"id": photo.id, "url": photo.url, "sort_order": photo.sort_order}

