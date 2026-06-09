"""
Voucher service — core business logic.
"""
import hashlib
import hmac
import io
import random
import string
from datetime import date, timedelta

import httpx
import qrcode
import qrcode.image.svg
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.voucher import IssuedVoucher, Partner, VoucherListing, VoucherOrder
from app.services.email import send_voucher_delivery_email


# ── Helpers ───────────────────────────────────────────────────────────────────

def _gen_code(db: Session) -> str:
    chars = string.ascii_uppercase + string.digits
    for _ in range(30):
        part1 = "".join(random.choices(chars, k=4))
        part2 = "".join(random.choices(chars, k=4))
        code = f"CC-{part1}-{part2}"
        if not db.query(IssuedVoucher).filter(IssuedVoucher.code == code).first():
            return code
    raise RuntimeError("Could not generate unique voucher code")


def _make_qr_svg(data: str) -> str:
    """Return an inline SVG QR code string."""
    factory = qrcode.image.svg.SvgPathImage
    img = qrcode.make(data, image_factory=factory, box_size=6, border=2)
    buf = io.BytesIO()
    img.save(buf)
    return buf.getvalue().decode("utf-8")


def _expires_iso(valid_days: int) -> str:
    if valid_days <= 0:
        return ""
    return (date.today() + timedelta(days=valid_days)).isoformat()


def _razorpay_client():
    return httpx.Client(
        base_url="https://api.razorpay.com/v1",
        auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET),
        timeout=15.0,
    )


def _razorpay_create_order(amount_paise: int, receipt: str, notes: dict) -> dict:
    with _razorpay_client() as client:
        res = client.post("/orders", json={
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "notes": notes,
        })
        res.raise_for_status()
        return res.json()


# ── Partner helpers ───────────────────────────────────────────────────────────

def get_partner_by_token(db: Session, token: str):
    return db.query(Partner).filter(
        Partner.partner_token == token, Partner.is_active == True
    ).first()


def get_partner_by_slug(db: Session, slug: str):
    return db.query(Partner).filter(
        Partner.slug == slug, Partner.is_active == True
    ).first()


# ── Listing helpers ───────────────────────────────────────────────────────────

def list_active_listings(db: Session, partner_id: int = 0):
    q = (
        db.query(VoucherListing)
        .options(joinedload(VoucherListing.partner))
        .filter(VoucherListing.is_active == True)
    )
    if partner_id:
        q = q.filter(VoucherListing.partner_id == partner_id)
    return q.order_by(VoucherListing.is_featured.desc(), VoucherListing.id.desc()).all()


def get_listing(db: Session, listing_id: int):
    return (
        db.query(VoucherListing)
        .options(joinedload(VoucherListing.partner))
        .filter(VoucherListing.id == listing_id, VoucherListing.is_active == True)
        .first()
    )


# ── Checkout ──────────────────────────────────────────────────────────────────

def create_order(
    db: Session,
    listing_id: int,
    quantity: int,
    buyer_email: str,
    buyer_name: str,
    buyer_phone: str,
    partner_ref: str,
    buyer_user_id: int = 0,
) -> VoucherOrder:
    listing = get_listing(db, listing_id)
    if not listing:
        raise ValueError("Voucher not found or no longer available")
    if listing.stock != -1 and listing.stock - listing.sold_count < quantity:
        raise ValueError("Not enough stock available")

    order = VoucherOrder(
        listing_id=listing_id,
        buyer_user_id=buyer_user_id if buyer_user_id else None,
        buyer_email=buyer_email.lower().strip(),
        buyer_name=buyer_name.strip(),
        buyer_phone=buyer_phone.strip(),
        partner_ref=partner_ref.strip(),
        amount_paid_paise=listing.price_inr * quantity * 100,
        quantity=quantity,
        payment_status="pending",
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def create_razorpay_order(order: VoucherOrder) -> dict:
    """Create a Razorpay order and return the order data."""
    if not settings.RAZORPAY_KEY_ID or settings.RAZORPAY_KEY_ID.startswith("rzp_test_REPLACE"):
        # Dev mode — return a fake order so the UI can be tested
        return {
            "id": f"order_DEV_{order.id}",
            "amount": order.amount_paid_paise,
            "currency": "INR",
        }
    return _razorpay_create_order(
        amount_paise=order.amount_paid_paise,
        receipt=f"cc_order_{order.id}",
        notes={"order_id": str(order.id), "buyer_email": order.buyer_email},
    )


def issue_vouchers(db: Session, order: VoucherOrder) -> list[IssuedVoucher]:
    """Issue voucher codes for a paid (or free) order."""
    listing = get_listing(db, order.listing_id)
    if not listing:
        raise ValueError("Listing not found")

    issued = []
    for _ in range(order.quantity):
        code = _gen_code(db)
        iv = IssuedVoucher(
            order_id=order.id,
            listing_id=order.listing_id,
            code=code,
            status="active",
            expires_at=_expires_iso(listing.valid_days),
        )
        db.add(iv)
        issued.append(iv)

    # Update stock counter
    if listing.stock != -1:
        listing.stock -= order.quantity
    listing.sold_count += order.quantity

    order.payment_status = "paid"
    db.commit()
    for iv in issued:
        db.refresh(iv)

    # Send delivery email
    send_voucher_delivery_email(
        to_email=order.buyer_email,
        buyer_name=order.buyer_name,
        vouchers=[(iv.code, listing.title, listing.value_label or f"₹{listing.value_amount} off") for iv in issued],
        partner_name=listing.partner.name,
    )

    return issued


def verify_razorpay_payment(
    db: Session,
    order_id: int,
    razorpay_payment_id: str,
    razorpay_order_id: str,
    razorpay_signature: str,
) -> list[IssuedVoucher]:
    order = db.get(VoucherOrder, order_id)
    if not order:
        raise ValueError("Order not found")
    if order.payment_status == "paid":
        # Already processed — return existing vouchers
        return db.query(IssuedVoucher).filter(IssuedVoucher.order_id == order_id).all()

    # Dev mode — skip signature verification
    if not settings.RAZORPAY_KEY_SECRET or settings.RAZORPAY_KEY_SECRET == "REPLACE_ME":
        order.razorpay_payment_id = razorpay_payment_id
        order.razorpay_order_id = razorpay_order_id
        db.commit()
        return issue_vouchers(db, order)

    # Verify signature
    body = f"{razorpay_order_id}|{razorpay_payment_id}"
    expected = hmac.new(  # type: ignore[attr-defined]
        settings.RAZORPAY_KEY_SECRET.encode(),
        body.encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(expected, razorpay_signature):
        order.payment_status = "failed"
        db.commit()
        raise ValueError("Payment signature verification failed")

    order.razorpay_payment_id = razorpay_payment_id
    order.razorpay_order_id = razorpay_order_id
    order.razorpay_signature = razorpay_signature
    db.commit()
    return issue_vouchers(db, order)


# ── Issued voucher serialization ──────────────────────────────────────────────

def serialize_issued(iv: IssuedVoucher) -> dict:
    listing = iv.listing
    partner = listing.partner
    value_label = listing.value_label or (
        f"₹{listing.value_amount} off" if listing.value_type == "discount_inr" else listing.value_type
    )
    return {
        "id": iv.id,
        "code": iv.code,
        "status": iv.status,
        "expires_at": iv.expires_at,
        "listing_title": listing.title,
        "listing_value_label": value_label,
        "partner_name": partner.name,
        "partner_city": partner.city,
        "qr_svg": _make_qr_svg(iv.code),
    }


# ── Guest lookup ──────────────────────────────────────────────────────────────

def lookup_voucher(db: Session, code: str):
    return (
        db.query(IssuedVoucher)
        .options(
            joinedload(IssuedVoucher.listing).joinedload(VoucherListing.partner)
        )
        .filter(IssuedVoucher.code == code.upper().strip())
        .first()
    )


# ── Redemption ────────────────────────────────────────────────────────────────

def redeem_voucher(db: Session, code: str, partner_id: int) -> IssuedVoucher:
    from datetime import date as _date
    iv = lookup_voucher(db, code)
    if not iv:
        raise ValueError("Voucher not found")
    if iv.status == "redeemed":
        raise ValueError("This voucher has already been redeemed")
    if iv.status == "expired":
        raise ValueError("This voucher has expired")
    if iv.expires_at and iv.expires_at < _date.today().isoformat():
        iv.status = "expired"
        db.commit()
        raise ValueError("This voucher has expired")
    # Verify the redeeming partner matches the listing's partner
    if iv.listing.partner_id != partner_id:
        raise ValueError("This voucher is not valid at your location")

    iv.status = "redeemed"
    iv.redeemed_at = _date.today().isoformat()
    iv.redeemed_by_partner_id = partner_id
    db.commit()
    db.refresh(iv)
    return iv


# ── Waitlist (early-access, kept for landing page) ────────────────────────────

_WAITLIST_BENEFIT = "₹200 off your first booking"


def get_or_create_waitlist_voucher(db: Session, email: str):
    """
    Landing page early-access form.
    Returns (WaitlistEntry, already_existed).
    """
    from app.models.waitlist import WaitlistEntry
    from app.services.email import send_voucher_email

    email = email.strip().lower()
    existing = db.query(WaitlistEntry).filter(WaitlistEntry.email == email).first()
    if existing:
        return existing, True

    # Generate unique code (check both tables)
    chars = string.ascii_uppercase + string.digits
    code = None
    for _ in range(30):
        p1 = "".join(random.choices(chars, k=4))
        p2 = "".join(random.choices(chars, k=4))
        candidate = f"CC-{p1}-{p2}"
        if (
            not db.query(WaitlistEntry).filter(WaitlistEntry.voucher_code == candidate).first()
            and not db.query(IssuedVoucher).filter(IssuedVoucher.code == candidate).first()
        ):
            code = candidate
            break
    if not code:
        raise RuntimeError("Could not generate unique code")

    entry = WaitlistEntry(email=email, voucher_code=code, benefit=_WAITLIST_BENEFIT)
    db.add(entry)
    db.commit()
    db.refresh(entry)

    send_voucher_email(email, code, _WAITLIST_BENEFIT)
    return entry, False
