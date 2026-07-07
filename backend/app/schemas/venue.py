import re

from pydantic import BaseModel, Field, field_validator

# Capacity: blank, a single number ("10"), or a range ("5-10").
CAPACITY_RE = re.compile(r"^(\d{1,6}(-\d{1,6})?)?$")


def _validate_capacity(v: str | None) -> str | None:
    if v is None:
        return v
    v = v.strip()
    if v == "":
        return ""
    if not CAPACITY_RE.match(v):
        raise ValueError('Capacity must be a number (e.g. "10") or a range (e.g. "5-10")')
    if "-" in v:
        low, high = (int(x) for x in v.split("-"))
        if low > high:
            raise ValueError("Capacity range must be low-high (e.g. 5-10)")
    return v


# ── Categories ────────────────────────────────────────────────────────────────

class CategoryRead(BaseModel):
    id: int
    slug: str
    name: str
    type: str
    icon_url: str


# ── Venue ─────────────────────────────────────────────────────────────────────

class VenueCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)
    logo_url: str = Field(default="", max_length=500)
    cover_url: str = Field(default="", max_length=500)
    phone: str = Field(default="", max_length=20)
    email: str = Field(default="", max_length=255)
    website: str = Field(default="", max_length=500)
    address_line1: str = Field(default="", max_length=300)
    address_line2: str = Field(default="", max_length=300)
    city: str = Field(default="", max_length=120)
    state: str = Field(default="", max_length=120)
    postal_code: str = Field(default="", max_length=20)
    lat: str = Field(default="", max_length=20)
    lng: str = Field(default="", max_length=20)


class VenueUpdate(VenueCreate):
    name: str = Field(default="", max_length=200)


class VenueRead(BaseModel):
    id: int
    name: str
    slug: str
    description: str
    logo_url: str
    cover_url: str
    phone: str
    email: str
    website: str
    address_line1: str
    city: str
    state: str
    postal_code: str
    lat: str
    lng: str
    is_verified: bool
    is_active: bool


# ── Listing ───────────────────────────────────────────────────────────────────

class PhotoRead(BaseModel):
    id: int
    url: str
    caption: str
    sort_order: int


class SlotRead(BaseModel):
    id: int
    day_of_week: int
    specific_date: str
    start_time: str
    end_time: str
    max_bookings: int
    is_blocked: bool


class ListingCreate(BaseModel):
    category_id: int
    title: str = Field(min_length=2, max_length=200)
    description: str = Field(default="", max_length=2000)
    rules: str = Field(default="", max_length=2000)
    capacity: str = Field(default="", max_length=20)
    price_per_hour: int = Field(default=0, ge=0)
    price_per_session: int = Field(default=0, ge=0)
    duration_minutes: int = Field(default=60, ge=15)
    is_bookable: bool = True
    is_tournament_eligible: bool = False

    @field_validator("capacity")
    @classmethod
    def _cap(cls, v: str) -> str:
        return _validate_capacity(v) or ""


class ListingUpdate(BaseModel):
    """Partial update — only provided fields are applied."""
    category_id: int | None = None
    title: str | None = Field(default=None, min_length=2, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    rules: str | None = Field(default=None, max_length=2000)
    capacity: str | None = Field(default=None, max_length=20)
    price_per_hour: int | None = Field(default=None, ge=0)
    price_per_session: int | None = Field(default=None, ge=0)
    duration_minutes: int | None = Field(default=None, ge=15)
    is_bookable: bool | None = None
    is_tournament_eligible: bool | None = None
    is_active: bool | None = None

    @field_validator("capacity")
    @classmethod
    def _cap(cls, v: str | None) -> str | None:
        return _validate_capacity(v)


class ListingRead(BaseModel):
    id: int
    venue_id: int
    category: CategoryRead
    title: str
    description: str
    rules: str
    capacity: str
    price_per_hour: int
    price_per_session: int
    duration_minutes: int
    is_bookable: bool
    is_tournament_eligible: bool
    is_active: bool
    photos: list[PhotoRead]
    amenities: list[str]


# ── Slots ─────────────────────────────────────────────────────────────────────

class SlotCreate(BaseModel):
    day_of_week: int = Field(default=-1, ge=-1, le=6)
    specific_date: str = Field(default="", max_length=10)
    start_time: str = Field(max_length=5)
    end_time: str = Field(max_length=5)
    max_bookings: int = Field(default=1, ge=1)


# ── Booking ───────────────────────────────────────────────────────────────────

class BookingCreate(BaseModel):
    listing_id: int
    slot_id: int
    booking_date: str
    num_players: int = Field(default=1, ge=1)
    notes: str = Field(default="", max_length=500)


class BookingRead(BaseModel):
    id: int
    listing_id: int
    booking_date: str
    start_time: str
    end_time: str
    num_players: int
    status: str
    payment_status: str
    notes: str


class BookingStatusUpdate(BaseModel):
    # pending | confirmed | cancelled | completed | no_show
    status: str = Field(max_length=20)
