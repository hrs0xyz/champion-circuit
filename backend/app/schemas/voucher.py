from pydantic import BaseModel, EmailStr, Field


# ── Partners ──────────────────────────────────────────────────────────────────

class PartnerRead(BaseModel):
    id: int
    name: str
    slug: str
    logo_url: str
    city: str
    description: str
    is_active: bool


# ── Listings ──────────────────────────────────────────────────────────────────

class ListingRead(BaseModel):
    id: int
    partner_id: int
    partner: PartnerRead
    title: str
    description: str
    terms: str
    value_type: str
    value_amount: int
    value_label: str
    price_inr: int
    stock: int
    sold_count: int
    valid_days: int
    image_url: str
    is_active: bool
    is_featured: bool


# ── Checkout ──────────────────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    listing_id: int
    quantity: int = Field(default=1, ge=1, le=10)
    buyer_email: EmailStr
    buyer_name: str = Field(default="", max_length=120)
    buyer_phone: str = Field(default="", max_length=20)
    partner_ref: str = Field(default="", max_length=40)


class CheckoutResponse(BaseModel):
    order_id: int                  # our DB order id
    razorpay_order_id: str         # Razorpay order id (starts with order_)
    razorpay_key_id: str           # public key for frontend
    amount_paise: int              # total in paise
    currency: str = "INR"
    listing_title: str
    buyer_name: str
    buyer_email: str


class FreeCheckoutResponse(BaseModel):
    """Returned when price_inr == 0 — no payment needed."""
    order_id: int
    vouchers: list["IssuedVoucherRead"]
    message: str = "Your voucher is ready!"


# ── Payment verification ──────────────────────────────────────────────────────

class PaymentVerifyRequest(BaseModel):
    order_id: int                  # our DB order id
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


class PaymentVerifyResponse(BaseModel):
    success: bool
    vouchers: list["IssuedVoucherRead"]
    message: str


# ── Issued vouchers ───────────────────────────────────────────────────────────

class IssuedVoucherRead(BaseModel):
    id: int
    code: str
    status: str
    expires_at: str
    listing_title: str
    listing_value_label: str
    partner_name: str
    partner_city: str
    qr_svg: str = ""   # inline SVG QR code


# ── Guest lookup ──────────────────────────────────────────────────────────────

class GuestLookupRequest(BaseModel):
    code: str = Field(min_length=10, max_length=20)


# ── Redemption ────────────────────────────────────────────────────────────────

class RedeemRequest(BaseModel):
    code: str = Field(min_length=10, max_length=20)


class RedeemResponse(BaseModel):
    success: bool
    message: str
    voucher: "IssuedVoucherRead"


# ── Waitlist (early-access, kept for landing page) ────────────────────────────

class WaitlistRequest(BaseModel):
    email: EmailStr


class WaitlistResponse(BaseModel):
    message: str
    voucher_code: str
    benefit: str
    already_registered: bool = False


# Forward refs
FreeCheckoutResponse.model_rebuild()
PaymentVerifyResponse.model_rebuild()
RedeemResponse.model_rebuild()
