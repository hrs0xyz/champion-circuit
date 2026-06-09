"""
Voucher commerce models.

Tables:
  partners          — turf owners / gaming cafes / streamers who list or refer
  voucher_listings  — the product catalog (created by CC or partners)
  voucher_orders    — a purchase (logged-in user OR guest)
  issued_vouchers   — the actual redeemable code, issued after payment
"""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.session import Base


# ── Partners ──────────────────────────────────────────────────────────────────

class Partner(Base):
    __tablename__ = "partners"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(60), unique=True, index=True, nullable=False)
    # Unique token used in referral links: /vouchers?ref=<partner_token>
    partner_token: Mapped[str] = mapped_column(String(40), unique=True, index=True, nullable=False)
    logo_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    contact_email: Mapped[str] = mapped_column(String(255), default="", nullable=False)
    contact_phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)
    city: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    listings: Mapped[list["VoucherListing"]] = relationship(
        "VoucherListing", back_populates="partner", lazy="select"
    )


# ── Voucher Listings (the product catalog) ────────────────────────────────────

class VoucherListing(Base):
    __tablename__ = "voucher_listings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    partner_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("partners.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # "cc" = Champion Circuit created it, "partner" = partner created it
    created_by: Mapped[str] = mapped_column(String(20), default="cc", nullable=False)

    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str] = mapped_column(Text, default="", nullable=False)
    terms: Mapped[str] = mapped_column(Text, default="", nullable=False)

    # What the voucher gives
    # "discount_inr" | "free_slot" | "free_entry" | "custom"
    value_type: Mapped[str] = mapped_column(String(30), default="discount_inr", nullable=False)
    value_amount: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # e.g. 200 for ₹200
    value_label: Mapped[str] = mapped_column(String(200), default="", nullable=False)  # e.g. "1 hour free"

    # What the buyer pays (0 = free giveaway)
    price_inr: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # -1 = unlimited
    stock: Mapped[int] = mapped_column(Integer, default=-1, nullable=False)
    sold_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Voucher expires N days after purchase (0 = never)
    valid_days: Mapped[int] = mapped_column(Integer, default=90, nullable=False)

    image_url: Mapped[str] = mapped_column(String(500), default="", nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    partner: Mapped["Partner"] = relationship("Partner", back_populates="listings")
    orders: Mapped[list["VoucherOrder"]] = relationship(
        "VoucherOrder", back_populates="listing", lazy="select"
    )


# ── Voucher Orders (a purchase) ───────────────────────────────────────────────

class VoucherOrder(Base):
    __tablename__ = "voucher_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    listing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("voucher_listings.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Buyer — null for guest checkout
    buyer_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True
    )
    buyer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    buyer_name: Mapped[str] = mapped_column(String(120), default="", nullable=False)
    buyer_phone: Mapped[str] = mapped_column(String(20), default="", nullable=False)

    # Which partner referred this buyer (from ?ref= token)
    partner_ref: Mapped[str] = mapped_column(String(40), default="", nullable=False)

    # Razorpay
    razorpay_order_id: Mapped[str] = mapped_column(String(100), default="", nullable=False, index=True)
    razorpay_payment_id: Mapped[str] = mapped_column(String(100), default="", nullable=False)
    razorpay_signature: Mapped[str] = mapped_column(String(200), default="", nullable=False)

    # "pending" | "paid" | "failed" | "refunded"
    payment_status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False, index=True)
    amount_paid_paise: Mapped[int] = mapped_column(Integer, default=0, nullable=False)  # in paise (₹1 = 100)

    quantity: Mapped[int] = mapped_column(Integer, default=1, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    listing: Mapped["VoucherListing"] = relationship("VoucherListing", back_populates="orders")
    issued_vouchers: Mapped[list["IssuedVoucher"]] = relationship(
        "IssuedVoucher", back_populates="order", lazy="select"
    )


# ── Issued Vouchers (the actual redeemable code) ──────────────────────────────

class IssuedVoucher(Base):
    __tablename__ = "issued_vouchers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("voucher_orders.id", ondelete="CASCADE"), nullable=False, index=True
    )
    listing_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("voucher_listings.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # The unique code — CC-XXXX-XXXX
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)

    # "active" | "redeemed" | "expired"
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False, index=True)

    redeemed_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)
    redeemed_by_partner_id: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    expires_at: Mapped[str] = mapped_column(String(30), default="", nullable=False)  # ISO date string

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    order: Mapped["VoucherOrder"] = relationship("VoucherOrder", back_populates="issued_vouchers")
    listing: Mapped["VoucherListing"] = relationship("VoucherListing")
