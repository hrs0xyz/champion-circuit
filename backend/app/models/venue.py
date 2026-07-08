"""
Venue, Listing, Booking models.

Tables:
  listing_categories  — seed data (Cricket, Badminton, Valorant …)
  venues              — business accounts (turf, gaming club, café)
  venue_admins        — staff attached to a venue
  venue_cover_photos  — up to 3 cover images per venue
  listings            — one activity per listing (Cricket Turf A, PS5 Pod)
  listing_photos      — up to 5 photos per listing
  listing_amenities   — tags like Floodlit, AC, WiFi
  listing_slots       — recurring bookable time windows
  bookings            — confirmed slot reservations
"""

from datetime import datetime

from sqlalchemy import (
    Boolean, DateTime, ForeignKey, Integer, String, Text, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


# ── Listing categories ────────────────────────────────────────────────────────

class ListingCategory(Base):
    __tablename__ = "listing_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    # physical | esports | food | merchandise | service
    type: Mapped[str] = mapped_column(String(30), nullable=False, default="physical")
    icon_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    listings: Mapped[list["Listing"]] = relationship("Listing", back_populates="category")


# ── Venues ────────────────────────────────────────────────────────────────────

class Venue(Base):
    __tablename__ = "venues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    owner_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    slug: Mapped[str] = mapped_column(String(80), unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    logo_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    cover_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    email: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    website: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    address_line1: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    address_line2: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    city: Mapped[str] = mapped_column(String(120), default="", nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    country: Mapped[str] = mapped_column(String(60), default="India", nullable=False)
    postal_code: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    lat: Mapped[str] = mapped_column(String(20), default="", nullable=False)   # stored as string to avoid float issues
    lng: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    listings: Mapped[list["Listing"]] = relationship("Listing", back_populates="venue")
    admins: Mapped[list["VenueAdmin"]] = relationship("VenueAdmin", back_populates="venue")
    cover_photos: Mapped[list["VenueCoverPhoto"]] = relationship(
        "VenueCoverPhoto", back_populates="venue",
        order_by="VenueCoverPhoto.sort_order", cascade="all, delete-orphan"
    )


# ── Venue cover photos (max 3) ────────────────────────────────────────────────

class VenueCoverPhoto(Base):
    __tablename__ = "venue_cover_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    venue_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    venue: Mapped["Venue"] = relationship("Venue", back_populates="cover_photos")


# ── Venue staff ───────────────────────────────────────────────────────────────

class VenueAdmin(Base):
    __tablename__ = "venue_admins"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    venue_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # owner | manager | staff
    role: Mapped[str] = mapped_column(String(20), default="staff", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    invited_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    accepted_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)

    venue: Mapped["Venue"] = relationship("Venue", back_populates="admins")


# ── Listings ──────────────────────────────────────────────────────────────────

class Listing(Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    venue_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("venues.id", ondelete="CASCADE"), nullable=False, index=True
    )
    category_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("listing_categories.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    rules: Mapped[str] = mapped_column(Text, default="", nullable=False)
    # Free-form capacity: a single number ("10") or a range ("5-10"), or blank.
    capacity: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    price_per_hour: Mapped[int] = mapped_column(Integer, default=0, nullable=False)   # paise
    price_per_session: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), default="INR", nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    is_bookable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_tournament_eligible: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    venue: Mapped["Venue"] = relationship("Venue", back_populates="listings")
    category: Mapped["ListingCategory"] = relationship("ListingCategory", back_populates="listings")
    photos: Mapped[list["ListingPhoto"]] = relationship(
        "ListingPhoto", back_populates="listing",
        order_by="ListingPhoto.sort_order", cascade="all, delete-orphan"
    )
    amenities: Mapped[list["ListingAmenity"]] = relationship(
        "ListingAmenity", back_populates="listing", cascade="all, delete-orphan"
    )
    slots: Mapped[list["ListingSlot"]] = relationship(
        "ListingSlot", back_populates="listing", cascade="all, delete-orphan"
    )


# ── Listing photos (max 5) ────────────────────────────────────────────────────

class ListingPhoto(Base):
    __tablename__ = "listing_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    url: Mapped[str] = mapped_column(String(500), nullable=False)
    caption: Mapped[str] = mapped_column(String(300), default="", nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    listing: Mapped["Listing"] = relationship("Listing", back_populates="photos")


# ── Listing amenities ─────────────────────────────────────────────────────────

class ListingAmenity(Base):
    __tablename__ = "listing_amenities"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label: Mapped[str] = mapped_column(String(100), nullable=False)

    listing: Mapped["Listing"] = relationship("Listing", back_populates="amenities")


# ── Listing slots ─────────────────────────────────────────────────────────────

class ListingSlot(Base):
    __tablename__ = "listing_slots"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    listing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("listings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # 0=Mon … 6=Sun, or leave -1 for a specific date
    day_of_week: Mapped[int] = mapped_column(Integer, default=-1, nullable=False)
    specific_date: Mapped[str] = mapped_column(String(10), default="", nullable=False)
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)   # HH:MM
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    max_bookings: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    is_blocked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    listing: Mapped["Listing"] = relationship("Listing", back_populates="slots")


# ── Bookings ──────────────────────────────────────────────────────────────────

class Booking(Base):
    __tablename__ = "bookings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("listings.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    slot_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("listing_slots.id", ondelete="RESTRICT"), nullable=True
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    booking_date: Mapped[str] = mapped_column(String(10), nullable=False)   # YYYY-MM-DD
    start_time: Mapped[str] = mapped_column(String(5), nullable=False)
    end_time: Mapped[str] = mapped_column(String(5), nullable=False)
    num_players: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    # pending | confirmed | cancelled | completed | no_show
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    # unpaid | paid | refunded
    payment_status: Mapped[str] = mapped_column(String(20), default="unpaid", nullable=False)
    amount_paid_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    razorpay_order_id: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    razorpay_payment_id: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    notes: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
