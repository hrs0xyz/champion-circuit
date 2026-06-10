"""
Venue routes — public browse + authenticated venue management.

Public:
  GET  /api/venues                  list venues (city filter)
  GET  /api/venues/{id}             venue detail + listings
  GET  /api/venues/{id}/listings    listings for a venue
  GET  /api/listings/{id}           single listing detail
  GET  /api/categories              all listing categories

Authenticated (any user):
  POST /api/bookings                book a slot
  GET  /api/bookings/me             my bookings

Venue owner / staff:
  POST /api/venues                  create venue
  PUT  /api/venues/{id}             update venue
  POST /api/venues/{id}/listings    add listing
  PUT  /api/listings/{id}           update listing
  POST /api/listings/{id}/photos    upload photo (multipart)
  DELETE /api/listings/{id}/photos/{photo_id}
  POST /api/listings/{id}/amenities set amenities
  POST /api/listings/{id}/slots     add time slot
  GET  /api/venues/{id}/bookings    venue bookings
"""

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.venue import BookingCreate, ListingCreate, SlotCreate, VenueCreate, VenueUpdate
from app.services.venue import (
    add_listing_photo,
    add_slot,
    create_booking,
    create_listing,
    create_venue,
    delete_listing_photo,
    get_all_categories,
    get_listing,
    get_user_bookings,
    get_user_venue,
    get_venue,
    get_venue_bookings,
    is_venue_staff,
    list_listings,
    list_venues,
    serialize_listing,
    serialize_venue,
    set_amenities,
    update_venue,
)

router = APIRouter()

ALLOWED_IMG = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
MAX_IMG = 5 * 1024 * 1024  # 5 MB for listing photos


# ── Categories ────────────────────────────────────────────────────────────────

@router.get("/categories")
def categories(db: Session = Depends(get_db)):
    cats = get_all_categories(db)
    return [{"id": c.id, "slug": c.slug, "name": c.name, "type": c.type, "icon_url": c.icon_url} for c in cats]


# ── Venues (public) ───────────────────────────────────────────────────────────

@router.get("/venues")
def browse_venues(city: str = "", skip: int = 0, limit: int = 40, db: Session = Depends(get_db)):
    venues = list_venues(db, city=city, skip=skip, limit=min(limit, 100))
    return [serialize_venue(v) for v in venues]


@router.get("/venues/{venue_id}")
def venue_detail(venue_id: int, db: Session = Depends(get_db)):
    v = get_venue(db, venue_id)
    if not v:
        raise HTTPException(status_code=404, detail="Venue not found")
    data = serialize_venue(v)
    data["listings"] = [serialize_listing(l) for l in v.listings if l.is_active]
    return data


@router.get("/venues/{venue_id}/listings")
def venue_listings(venue_id: int, db: Session = Depends(get_db)):
    listings = list_listings(db, venue_id)
    return [serialize_listing(l) for l in listings]


@router.get("/listings/{listing_id}")
def listing_detail(listing_id: int, db: Session = Depends(get_db)):
    listing = get_listing(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    return serialize_listing(listing)


# ── Venue management (owner/staff) ───────────────────────────────────────────

@router.post("/venues", status_code=status.HTTP_201_CREATED)
def create_my_venue(
    payload: VenueCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = get_user_venue(db, current_user.id)
    if existing and not current_user.is_admin:
        raise HTTPException(status_code=400, detail="You already have a venue. Contact admin to create more.")
    v = create_venue(db, payload, current_user.id)
    return serialize_venue(v)


@router.put("/venues/{venue_id}")
def update_my_venue(
    venue_id: int,
    payload: VenueUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = get_venue(db, venue_id)
    if not v:
        raise HTTPException(status_code=404, detail="Venue not found")
    if not current_user.is_admin and not is_venue_staff(db, venue_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised")
    return serialize_venue(update_venue(db, v, payload))


@router.post("/venues/{venue_id}/listings", status_code=status.HTTP_201_CREATED)
def add_listing(
    venue_id: int,
    payload: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = get_venue(db, venue_id)
    if not v:
        raise HTTPException(status_code=404, detail="Venue not found")
    if not current_user.is_admin and not is_venue_staff(db, venue_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised")
    listing = create_listing(db, venue_id, payload)
    return serialize_listing(listing)


@router.post("/listings/{listing_id}/photos", status_code=status.HTTP_201_CREATED)
async def upload_listing_photo(
    listing_id: int,
    sort_order: int = 1,
    caption: str = "",
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = get_listing(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if not current_user.is_admin and not is_venue_staff(db, listing.venue_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised")
    if file.content_type not in ALLOWED_IMG:
        raise HTTPException(status_code=400, detail="Upload a JPG, PNG, or WEBP image")
    data = await file.read()
    if len(data) > MAX_IMG:
        raise HTTPException(status_code=400, detail="Image must be 5 MB or smaller")
    upload_dir = Path(settings.UPLOAD_DIR) / "listings"
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = ALLOWED_IMG[file.content_type]
    filename = f"listing-{listing_id}-{uuid4().hex}{ext}"
    (upload_dir / filename).write_bytes(data)
    url = f"{settings.PUBLIC_BASE_URL}/uploads/listings/{filename}"
    try:
        photo = add_listing_photo(db, listing_id, url, caption, sort_order)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"id": photo.id, "url": photo.url, "caption": photo.caption, "sort_order": photo.sort_order}


@router.delete("/listings/{listing_id}/photos/{photo_id}")
def remove_listing_photo(
    listing_id: int,
    photo_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = get_listing(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if not current_user.is_admin and not is_venue_staff(db, listing.venue_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised")
    if not delete_listing_photo(db, photo_id, listing_id):
        raise HTTPException(status_code=404, detail="Photo not found")
    return {"message": "Deleted"}


@router.post("/listings/{listing_id}/amenities")
def update_amenities(
    listing_id: int,
    labels: list[str],
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = get_listing(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if not current_user.is_admin and not is_venue_staff(db, listing.venue_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised")
    set_amenities(db, listing_id, labels)
    return {"message": "Updated"}


@router.post("/listings/{listing_id}/slots", status_code=status.HTTP_201_CREATED)
def create_slot(
    listing_id: int,
    payload: SlotCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    listing = get_listing(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")
    if not current_user.is_admin and not is_venue_staff(db, listing.venue_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised")
    slot = add_slot(db, listing_id, payload)
    return {"id": slot.id, "start_time": slot.start_time, "end_time": slot.end_time,
            "day_of_week": slot.day_of_week}


@router.get("/venues/{venue_id}/bookings")
def venue_bookings(
    venue_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    v = get_venue(db, venue_id)
    if not v:
        raise HTTPException(status_code=404, detail="Venue not found")
    if not current_user.is_admin and not is_venue_staff(db, venue_id, current_user.id):
        raise HTTPException(status_code=403, detail="Not authorised")
    bookings = get_venue_bookings(db, venue_id)
    return [
        {
            "id": b.id, "listing_id": b.listing_id,
            "booking_date": b.booking_date, "start_time": b.start_time,
            "end_time": b.end_time, "status": b.status,
            "num_players": b.num_players, "user_id": b.user_id,
        }
        for b in bookings
    ]


# ── Bookings (user) ───────────────────────────────────────────────────────────

@router.post("/bookings", status_code=status.HTTP_201_CREATED)
def book_slot(
    payload: BookingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        booking = create_booking(db, current_user.id, payload)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {
        "id": booking.id, "listing_id": booking.listing_id,
        "booking_date": booking.booking_date,
        "start_time": booking.start_time, "end_time": booking.end_time,
        "status": booking.status, "message": "Booking confirmed",
    }


@router.get("/bookings/me")
def my_bookings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    bookings = get_user_bookings(db, current_user.id)
    return [
        {
            "id": b.id, "listing_id": b.listing_id,
            "booking_date": b.booking_date, "start_time": b.start_time,
            "end_time": b.end_time, "status": b.status,
            "payment_status": b.payment_status, "num_players": b.num_players,
        }
        for b in bookings
    ]
