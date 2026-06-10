"""
Venue, listing, booking service layer.
"""
import re
from sqlalchemy.orm import Session, joinedload

from app.models.venue import (
    Booking, Listing, ListingAmenity, ListingCategory,
    ListingPhoto, ListingSlot, Venue, VenueAdmin,
)
from app.schemas.venue import (
    BookingCreate, ListingCreate, SlotCreate, VenueCreate, VenueUpdate,
)


# ── Slug helpers ──────────────────────────────────────────────────────────────

def _slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text[:80]


def _unique_slug(db: Session, base: str, model) -> str:
    slug = _slugify(base)
    candidate = slug
    n = 1
    while db.query(model).filter(model.slug == candidate).first():
        n += 1
        candidate = f"{slug}-{n}"
    return candidate


# ── Categories ────────────────────────────────────────────────────────────────

def get_all_categories(db: Session) -> list[ListingCategory]:
    return db.query(ListingCategory).filter(ListingCategory.is_active == True).order_by(ListingCategory.name).all()  # noqa: E712


def get_category(db: Session, category_id: int) -> ListingCategory | None:
    return db.get(ListingCategory, category_id)


# ── Venues ────────────────────────────────────────────────────────────────────

def create_venue(db: Session, payload: VenueCreate, owner_user_id: int) -> Venue:
    slug = _unique_slug(db, payload.name, Venue)
    venue = Venue(
        owner_user_id=owner_user_id,
        slug=slug,
        **payload.model_dump(),
    )
    db.add(venue)
    db.flush()
    # Auto-add owner as venue admin with role=owner
    admin = VenueAdmin(venue_id=venue.id, user_id=owner_user_id, role="owner")
    db.add(admin)
    db.commit()
    db.refresh(venue)
    return venue


def get_venue(db: Session, venue_id: int) -> Venue | None:
    return (
        db.query(Venue)
        .options(joinedload(Venue.listings).joinedload(Listing.photos))
        .filter(Venue.id == venue_id)
        .first()
    )


def list_venues(db: Session, city: str = "", skip: int = 0, limit: int = 40) -> list[Venue]:
    q = db.query(Venue).filter(Venue.is_active == True)  # noqa: E712
    if city:
        q = q.filter(Venue.city.ilike(f"%{city}%"))
    return q.order_by(Venue.is_verified.desc(), Venue.name).offset(skip).limit(limit).all()


def update_venue(db: Session, venue: Venue, payload: VenueUpdate) -> Venue:
    for key, val in payload.model_dump(exclude_unset=True).items():
        if val:
            setattr(venue, key, val)
    db.commit()
    db.refresh(venue)
    return venue


def get_user_venue(db: Session, user_id: int) -> Venue | None:
    """Return the venue owned by this user, if any."""
    return db.query(Venue).filter(Venue.owner_user_id == user_id, Venue.is_active == True).first()  # noqa: E712


def is_venue_staff(db: Session, venue_id: int, user_id: int) -> bool:
    return (
        db.query(VenueAdmin)
        .filter(
            VenueAdmin.venue_id == venue_id,
            VenueAdmin.user_id == user_id,
            VenueAdmin.is_active == True,  # noqa: E712
        )
        .first()
    ) is not None


# ── Listings ──────────────────────────────────────────────────────────────────

def create_listing(db: Session, venue_id: int, payload: ListingCreate) -> Listing:
    listing = Listing(venue_id=venue_id, **payload.model_dump())
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return listing


def get_listing(db: Session, listing_id: int) -> Listing | None:
    return (
        db.query(Listing)
        .options(
            joinedload(Listing.photos),
            joinedload(Listing.amenities),
            joinedload(Listing.slots),
            joinedload(Listing.category),
        )
        .filter(Listing.id == listing_id)
        .first()
    )


def list_listings(db: Session, venue_id: int) -> list[Listing]:
    return (
        db.query(Listing)
        .options(joinedload(Listing.photos), joinedload(Listing.category))
        .filter(Listing.venue_id == venue_id, Listing.is_active == True)  # noqa: E712
        .all()
    )


def add_listing_photo(db: Session, listing_id: int, url: str, caption: str = "", sort_order: int = 1) -> ListingPhoto:
    # Enforce max 5 photos
    count = db.query(ListingPhoto).filter(ListingPhoto.listing_id == listing_id).count()
    if count >= 5:
        raise ValueError("Maximum 5 photos per listing")
    photo = ListingPhoto(listing_id=listing_id, url=url, caption=caption, sort_order=sort_order)
    db.add(photo)
    db.commit()
    db.refresh(photo)
    return photo


def delete_listing_photo(db: Session, photo_id: int, listing_id: int) -> bool:
    photo = db.query(ListingPhoto).filter(
        ListingPhoto.id == photo_id, ListingPhoto.listing_id == listing_id
    ).first()
    if not photo:
        return False
    db.delete(photo)
    db.commit()
    return True


def set_amenities(db: Session, listing_id: int, labels: list[str]) -> None:
    db.query(ListingAmenity).filter(ListingAmenity.listing_id == listing_id).delete()
    for label in labels:
        if label.strip():
            db.add(ListingAmenity(listing_id=listing_id, label=label.strip()[:100]))
    db.commit()


def add_slot(db: Session, listing_id: int, payload: SlotCreate) -> ListingSlot:
    slot = ListingSlot(listing_id=listing_id, **payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


# ── Bookings ──────────────────────────────────────────────────────────────────

def create_booking(db: Session, user_id: int, payload: BookingCreate) -> Booking:
    slot = db.get(ListingSlot, payload.slot_id)
    if not slot:
        raise ValueError("Slot not found")
    booking = Booking(
        listing_id=payload.listing_id,
        slot_id=payload.slot_id,
        user_id=user_id,
        booking_date=payload.booking_date,
        start_time=slot.start_time,
        end_time=slot.end_time,
        num_players=payload.num_players,
        notes=payload.notes,
        status="confirmed",
    )
    db.add(booking)
    db.commit()
    db.refresh(booking)
    return booking


def get_user_bookings(db: Session, user_id: int) -> list[Booking]:
    return (
        db.query(Booking)
        .filter(Booking.user_id == user_id)
        .order_by(Booking.booking_date.desc())
        .all()
    )


def get_venue_bookings(db: Session, venue_id: int) -> list[Booking]:
    return (
        db.query(Booking)
        .join(Listing, Booking.listing_id == Listing.id)
        .filter(Listing.venue_id == venue_id)
        .order_by(Booking.booking_date.desc())
        .all()
    )


def serialize_listing(listing: Listing) -> dict:
    return {
        "id": listing.id,
        "venue_id": listing.venue_id,
        "category": {
            "id": listing.category.id,
            "slug": listing.category.slug,
            "name": listing.category.name,
            "type": listing.category.type,
            "icon_url": listing.category.icon_url,
        } if listing.category else {},
        "title": listing.title,
        "description": listing.description,
        "rules": listing.rules,
        "capacity": listing.capacity,
        "price_per_hour": listing.price_per_hour,
        "price_per_session": listing.price_per_session,
        "duration_minutes": listing.duration_minutes,
        "is_bookable": listing.is_bookable,
        "is_tournament_eligible": listing.is_tournament_eligible,
        "is_active": listing.is_active,
        "photos": [
            {"id": p.id, "url": p.url, "caption": p.caption, "sort_order": p.sort_order}
            for p in listing.photos
        ],
        "amenities": [a.label for a in listing.amenities],
    }


def serialize_venue(venue: Venue) -> dict:
    return {
        "id": venue.id,
        "name": venue.name,
        "slug": venue.slug,
        "description": venue.description,
        "logo_url": venue.logo_url,
        "cover_url": venue.cover_url,
        "phone": venue.phone,
        "email": venue.email,
        "website": venue.website,
        "address_line1": venue.address_line1,
        "city": venue.city,
        "state": venue.state,
        "postal_code": venue.postal_code,
        "lat": venue.lat,
        "lng": venue.lng,
        "is_verified": venue.is_verified,
        "is_active": venue.is_active,
    }
