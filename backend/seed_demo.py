"""
Run once to seed demo partner + voucher listings.
Usage: .venv/bin/python seed_demo.py
"""
import sys
sys.path.insert(0, ".")

from app.db.session import SessionLocal, Base, engine
from app.models.user import User  # noqa — needed for FK resolution
from app.models.voucher import Partner, VoucherListing
from app.models.waitlist import WaitlistEntry  # noqa — ensure table registered
import secrets

# Create all tables (idempotent)
Base.metadata.create_all(bind=engine)

db = SessionLocal()

# Create demo partner
partner = db.query(Partner).filter(Partner.slug == "kolkata-turf-arena").first()
if not partner:
    partner = Partner(
        name="Kolkata Turf Arena",
        slug="kolkata-turf-arena",
        partner_token=secrets.token_urlsafe(20),
        city="Kolkata",
        description="Premium 5-a-side turf in South Kolkata. Floodlit, all-weather surface.",
        contact_email="info@kolkataturfarena.com",
        contact_phone="+91 98765 43210",
        is_active=True,
    )
    db.add(partner)
    db.flush()
    print(f"Created partner: {partner.name} | token: {partner.partner_token}")
else:
    print(f"Partner already exists: {partner.name} | token: {partner.partner_token}")

# Create listings
listings_data = [
    {
        "title": "₹200 Off Your First Booking",
        "description": "New to Kolkata Turf Arena? Get ₹200 off your first turf slot booking.",
        "terms": "Valid for new customers only. Cannot be combined with other offers.",
        "value_type": "discount_inr",
        "value_amount": 200,
        "value_label": "₹200 off first booking",
        "price_inr": 99,
        "stock": 50,
        "valid_days": 60,
        "is_featured": True,
    },
    {
        "title": "1 Hour Free Turf Slot",
        "description": "Redeem a complimentary 1-hour turf slot on weekday mornings (6am–10am).",
        "terms": "Weekdays only, 6am–10am. Subject to availability. Advance booking required.",
        "value_type": "free_slot",
        "value_amount": 0,
        "value_label": "1 hour free turf slot",
        "price_inr": 299,
        "stock": 20,
        "valid_days": 30,
        "is_featured": False,
    },
    {
        "title": "Tournament Entry Pass",
        "description": "Free entry to any upcoming 5-a-side tournament at Kolkata Turf Arena.",
        "terms": "One entry per voucher. Valid for tournaments listed on Champion Circuit.",
        "value_type": "free_entry",
        "value_amount": 0,
        "value_label": "Free tournament entry",
        "price_inr": 149,
        "stock": -1,
        "valid_days": 90,
        "is_featured": False,
    },
]

for data in listings_data:
    existing = db.query(VoucherListing).filter(
        VoucherListing.partner_id == partner.id,
        VoucherListing.title == data["title"]
    ).first()
    if not existing:
        listing = VoucherListing(partner_id=partner.id, created_by="cc", **data)
        db.add(listing)
        print(f"  Created listing: {data['title']}")
    else:
        print(f"  Listing already exists: {data['title']}")

db.commit()
db.close()
print("\nDone! Visit http://127.0.0.1:5173/vouchers to see the listings.")
print(f"Partner referral link: http://127.0.0.1:5173/vouchers?ref={partner.partner_token}")
