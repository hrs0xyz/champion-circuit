"""
Voucher routes:

  GET  /api/vouchers                    — list active listings (public)
  GET  /api/vouchers/{id}               — single listing (public)
  POST /api/vouchers/checkout           — create order + Razorpay order
  POST /api/vouchers/payment/verify     — verify payment → issue codes
  GET  /api/vouchers/my                 — logged-in user's vouchers
  POST /api/vouchers/lookup             — guest lookup by code
  POST /api/vouchers/redeem             — partner redeems a code (auth required)

  POST /api/waitlist                    — early-access waitlist (landing page)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_optional_user
from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.models.voucher import IssuedVoucher, VoucherOrder
from app.schemas.voucher import (
    CheckoutRequest,
    CheckoutResponse,
    FreeCheckoutResponse,
    GuestLookupRequest,
    IssuedVoucherRead,
    ListingRead,
    PartnerRead,
    PaymentVerifyRequest,
    PaymentVerifyResponse,
    RedeemRequest,
    RedeemResponse,
    WaitlistRequest,
    WaitlistResponse,
)
from app.services.voucher import (
    create_order,
    create_razorpay_order,
    get_or_create_waitlist_voucher,
    get_partner_by_token,
    issue_vouchers,
    list_active_listings,
    get_listing,
    lookup_voucher,
    redeem_voucher,
    serialize_issued,
    verify_razorpay_payment,
)

router = APIRouter()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _listing_to_read(listing) -> ListingRead:
    p = listing.partner
    return ListingRead(
        id=listing.id,
        partner_id=listing.partner_id,
        partner=PartnerRead(
            id=p.id, name=p.name, slug=p.slug,
            logo_url=p.logo_url, city=p.city,
            description=p.description, is_active=p.is_active,
        ),
        title=listing.title,
        description=listing.description,
        terms=listing.terms,
        value_type=listing.value_type,
        value_amount=listing.value_amount,
        value_label=listing.value_label,
        price_inr=listing.price_inr,
        stock=listing.stock,
        sold_count=listing.sold_count,
        valid_days=listing.valid_days,
        image_url=listing.image_url,
        is_active=listing.is_active,
        is_featured=listing.is_featured,
    )


def _iv_to_read(iv) -> IssuedVoucherRead:
    d = serialize_issued(iv)
    return IssuedVoucherRead(**d)


# ── Public listing endpoints ──────────────────────────────────────────────────

@router.get("/vouchers", response_model=list[ListingRead])
def browse_vouchers(
    partner_ref: str = "",
    db: Session = Depends(get_db),
) -> list[ListingRead]:
    """
    List active voucher listings.
    If ?partner_ref=TOKEN is provided, filter to that partner's listings.
    """
    partner_id = 0
    if partner_ref:
        partner = get_partner_by_token(db, partner_ref)
        if partner:
            partner_id = partner.id
    listings = list_active_listings(db, partner_id=partner_id)
    return [_listing_to_read(l) for l in listings]


@router.get("/vouchers/{listing_id}", response_model=ListingRead)
def get_voucher_listing(listing_id: int, db: Session = Depends(get_db)) -> ListingRead:
    listing = get_listing(db, listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return _listing_to_read(listing)


# ── Checkout ──────────────────────────────────────────────────────────────────

@router.post("/vouchers/checkout")
def checkout(
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_optional_user),
):
    """
    Create an order. Returns Razorpay order details for the frontend to open
    the payment modal. If price_inr == 0, issues vouchers immediately.
    """
    listing = get_listing(db, payload.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Voucher not found")

    buyer_email = payload.buyer_email or (current_user.email if current_user else "")
    buyer_name = payload.buyer_name or (current_user.name if current_user else "")
    buyer_user_id = current_user.id if current_user else 0

    try:
        order = create_order(
            db,
            listing_id=payload.listing_id,
            quantity=payload.quantity,
            buyer_email=buyer_email,
            buyer_name=buyer_name,
            buyer_phone=payload.buyer_phone,
            partner_ref=payload.partner_ref,
            buyer_user_id=buyer_user_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Free voucher — issue immediately
    if listing.price_inr == 0:
        issued = issue_vouchers(db, order)
        return FreeCheckoutResponse(
            order_id=order.id,
            vouchers=[_iv_to_read(iv) for iv in issued],
        )

    # Paid — create Razorpay order
    rz_order = create_razorpay_order(order)
    order.razorpay_order_id = rz_order["id"]
    db.commit()

    return CheckoutResponse(
        order_id=order.id,
        razorpay_order_id=rz_order["id"],
        razorpay_key_id=settings.RAZORPAY_KEY_ID,
        amount_paise=rz_order["amount"],
        listing_title=listing.title,
        buyer_name=buyer_name,
        buyer_email=buyer_email,
    )


@router.post("/vouchers/checkout/guest")
def guest_checkout(
    payload: CheckoutRequest,
    db: Session = Depends(get_db),
):
    """
    Guest checkout — no login required.
    Phase 3: external traffic from partner referral links.
    """
    listing = get_listing(db, payload.listing_id)
    if not listing:
        raise HTTPException(status_code=404, detail="Voucher not found")

    try:
        order = create_order(
            db,
            listing_id=payload.listing_id,
            quantity=payload.quantity,
            buyer_email=payload.buyer_email,
            buyer_name=payload.buyer_name,
            buyer_phone=payload.buyer_phone,
            partner_ref=payload.partner_ref,
            buyer_user_id=0,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if listing.price_inr == 0:
        issued = issue_vouchers(db, order)
        return FreeCheckoutResponse(
            order_id=order.id,
            vouchers=[_iv_to_read(iv) for iv in issued],
        )

    rz_order = create_razorpay_order(order)
    order.razorpay_order_id = rz_order["id"]
    db.commit()

    return CheckoutResponse(
        order_id=order.id,
        razorpay_order_id=rz_order["id"],
        razorpay_key_id=settings.RAZORPAY_KEY_ID,
        amount_paise=rz_order["amount"],
        listing_title=listing.title,
        buyer_name=payload.buyer_name,
        buyer_email=payload.buyer_email,
    )


# ── Payment verification ──────────────────────────────────────────────────────

@router.post("/vouchers/payment/verify", response_model=PaymentVerifyResponse)
def verify_payment(
    payload: PaymentVerifyRequest,
    db: Session = Depends(get_db),
) -> PaymentVerifyResponse:
    try:
        issued = verify_razorpay_payment(
            db,
            order_id=payload.order_id,
            razorpay_payment_id=payload.razorpay_payment_id,
            razorpay_order_id=payload.razorpay_order_id,
            razorpay_signature=payload.razorpay_signature,
        )
        return PaymentVerifyResponse(
            success=True,
            vouchers=[_iv_to_read(iv) for iv in issued],
            message="Payment successful! Your voucher is ready.",
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── My vouchers (logged-in) ───────────────────────────────────────────────────

@router.get("/vouchers/my/list", response_model=list[IssuedVoucherRead])
def my_vouchers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[IssuedVoucherRead]:
    from sqlalchemy.orm import joinedload as jl
    orders = (
        db.query(VoucherOrder)
        .filter(
            VoucherOrder.buyer_user_id == current_user.id,
            VoucherOrder.payment_status == "paid",
            VoucherOrder.listing_id != 0,
        )
        .all()
    )
    order_ids = [o.id for o in orders]
    if not order_ids:
        return []
    issued = (
        db.query(IssuedVoucher)
        .filter(IssuedVoucher.order_id.in_(order_ids))
        .order_by(IssuedVoucher.created_at.desc())
        .all()
    )
    # Eagerly load relationships for serialization
    result = []
    for iv in issued:
        _ = iv.listing.partner  # trigger lazy load
        result.append(_iv_to_read(iv))
    return result


# ── Guest lookup ──────────────────────────────────────────────────────────────

@router.post("/vouchers/lookup", response_model=IssuedVoucherRead)
def guest_lookup(
    payload: GuestLookupRequest,
    db: Session = Depends(get_db),
) -> IssuedVoucherRead:
    iv = lookup_voucher(db, payload.code)
    if not iv or iv.listing_id == 0:
        raise HTTPException(status_code=404, detail="Voucher not found")
    return _iv_to_read(iv)


# ── Redemption ────────────────────────────────────────────────────────────────

@router.post("/vouchers/redeem", response_model=RedeemResponse)
def redeem(
    payload: RedeemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> RedeemResponse:
    """
    Partner staff redeems a voucher code.
    The logged-in user must be linked to a partner (via is_admin or partner_id).
    For now, admins can redeem any voucher.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only partner staff can redeem vouchers",
        )
    iv = lookup_voucher(db, payload.code)
    if not iv or iv.listing_id == 0:
        raise HTTPException(status_code=404, detail="Voucher not found")

    try:
        # Admin can redeem for any partner — use listing's partner_id
        iv = redeem_voucher(db, payload.code, iv.listing.partner_id)
        return RedeemResponse(
            success=True,
            message="Voucher redeemed successfully.",
            voucher=_iv_to_read(iv),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Waitlist (landing page early-access) ─────────────────────────────────────

@router.post("/waitlist", response_model=WaitlistResponse)
def join_waitlist(
    payload: WaitlistRequest,
    db: Session = Depends(get_db),
) -> WaitlistResponse:
    entry, already = get_or_create_waitlist_voucher(db, payload.email)
    return WaitlistResponse(
        message=(
            "You're already on the list! Check your original email."
            if already
            else "You're in! Check your email for your voucher code."
        ),
        voucher_code=entry.voucher_code,
        benefit=entry.benefit,
        already_registered=already,
    )
