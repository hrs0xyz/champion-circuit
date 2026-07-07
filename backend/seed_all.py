"""
Full seed: admin, turf owner, demo venue + listings, demo tournament.
Run: .venv/bin/python seed_all.py
"""
import sys
sys.path.insert(0, ".")

from app.db.session import SessionLocal, Base, engine
from app.models.user import User
from app.models.venue import Venue, VenueAdmin, Listing, ListingCategory
from app.models.match import Tournament
from app.models.voucher import Partner, VoucherListing
from app.models.waitlist import WaitlistEntry  # noqa
from app.core.security import hash_password

Base.metadata.create_all(bind=engine)
db = SessionLocal()


def get_or_create_user(username, email, password, is_admin=False, is_venue_owner=False, name=""):
    u = db.query(User).filter(User.username == username).first()
    if u:
        print(f"  EXISTS   @{username}")
        return u
    u = User(
        username=username,
        email=email,
        hashed_password=hash_password(password),
        auth_provider="password",
        name=name or username,
        is_admin=is_admin,
        is_venue_owner=is_venue_owner,
        is_active=True,
    )
    db.add(u)
    db.flush()
    print(f"  CREATED  @{username}  ({email})  admin={is_admin}  venue_owner={is_venue_owner}")
    return u


print("\n=== Users ===")
# Super admin
admin = get_or_create_user(
    username="admin",
    email="admin@championcircuit.com",
    password="admin",
    is_admin=True,
    name="Super Admin",
)

# Turf owner
turf_owner = get_or_create_user(
    username="turfowner",
    email="turf@championcircuit.com",
    password="turf1234",
    is_venue_owner=True,
    name="Turf Owner",
)

# Match admin (assigned by super admin to a tournament)
match_admin = get_or_create_user(
    username="matchadmin",
    email="matchadmin@championcircuit.com",
    password="match1234",
    name="Match Admin",
)

db.commit()

# ── Demo venue ────────────────────────────────────────────────────────────────
print("\n=== Venue ===")
venue = db.query(Venue).filter(Venue.slug == "kolkata-central-arena").first()
if not venue:
    venue = Venue(
        owner_user_id=turf_owner.id,
        name="Kolkata Central Arena",
        slug="kolkata-central-arena",
        description="Premium multi-sport facility in the heart of Kolkata. Cricket, Badminton, PS5 Pods, and more.",
        phone="+91 98765 43210",
        email="kolkata@championcircuit.com",
        address_line1="83, S. P. Mukherjee Road, Devi Market, 4th Floor",
        city="Kolkata",
        state="West Bengal",
        country="India",
        postal_code="700026",
        is_verified=True,
        is_active=True,
    )
    db.add(venue)
    db.flush()
    # Add turf owner as venue admin
    va = VenueAdmin(venue_id=venue.id, user_id=turf_owner.id, role="owner")
    db.add(va)
    db.commit()
    print(f"  CREATED  Venue: {venue.name} (id={venue.id})")
else:
    print(f"  EXISTS   Venue: {venue.name} (id={venue.id})")

# ── Listings ──────────────────────────────────────────────────────────────────
print("\n=== Listings ===")
cricket_cat = db.query(ListingCategory).filter(ListingCategory.slug == "cricket").first()
badminton_cat = db.query(ListingCategory).filter(ListingCategory.slug == "badminton").first()
ps_cat = db.query(ListingCategory).filter(ListingCategory.slug == "playstation").first()

listing_data = [
    {
        "category": cricket_cat,
        "title": "Cricket Turf A",
        "description": "Full-pitch floodlit cricket turf. Synthetic surface, changing rooms included.",
        "capacity": "22",
        "price_per_hour": 150000,  # ₹1500 in paise
        "duration_minutes": 120,
        "is_bookable": True,
        "is_tournament_eligible": True,
    },
    {
        "category": badminton_cat,
        "title": "Badminton Court 1",
        "description": "Wooden flooring, BWF-standard net. Air-conditioned.",
        "capacity": "4",
        "price_per_hour": 60000,  # ₹600
        "duration_minutes": 60,
        "is_bookable": True,
        "is_tournament_eligible": True,
    },
    {
        "category": ps_cat,
        "title": "PlayStation 5 Gaming Pod",
        "description": "Private PS5 gaming pod with 55\" 4K TV, racing wheel, and FIFA/EA FC.",
        "capacity": "2",
        "price_per_session": 25000,  # ₹250 per session
        "duration_minutes": 60,
        "is_bookable": True,
        "is_tournament_eligible": False,
    },
]

for data in listing_data:
    cat = data.pop("category")
    if not cat:
        print(f"  SKIP     (category not found)")
        continue
    existing = db.query(Listing).filter(
        Listing.venue_id == venue.id,
        Listing.title == data["title"],
    ).first()
    if existing:
        print(f"  EXISTS   {data['title']}")
    else:
        listing = Listing(venue_id=venue.id, category_id=cat.id, **data)
        db.add(listing)
        print(f"  CREATED  {data['title']}")

db.commit()

# ── Demo tournament ────────────────────────────────────────────────────────────
print("\n=== Tournament ===")
t = db.query(Tournament).filter(Tournament.slug == "kolkata-valorant-open-2026").first()
if not t:
    t = Tournament(
        venue_id=venue.id,
        name="Kolkata Valorant Open 2026",
        slug="kolkata-valorant-open-2026",
        description="Open bracket tournament for Valorant teams across Kolkata. Best of 3 finals.",
        rules="5v5, own device, no coaching during match.",
        game="valorant",
        format="double_elim",
        mode="squad",
        max_participants=16,
        entry_fee_paise=14900,  # ₹149
        prize_pool_paise=500000,  # ₹5000
        prize_description="1st: ₹3000 + Trophy | 2nd: ₹1500 | 3rd: ₹500",
        registration_open=True,
        starts_at="2026-07-15",
        ends_at="2026-07-20",
        status="registration",
        is_featured=True,
        created_by=admin.id,
    )
    db.add(t)
    db.commit()
    print(f"  CREATED  {t.name} (id={t.id})")

    # Assign match_admin to this tournament via score_adjustments note
    # (match admin assignment is tracked separately — see below)
    print(f"  Match admin @matchadmin can manage scores for tournament id={t.id}")
else:
    print(f"  EXISTS   {t.name}")

db.commit()
db.close()

print("\n" + "="*50)
print("SEED COMPLETE")
print("="*50)
print("""
LOGIN CREDENTIALS
─────────────────────────────────────────────
Super Admin
  username : admin
  password : admin
  access   : everything — users, venues, news,
             vouchers, tournaments, scoring

Turf Owner
  username : turfowner
  password : turf1234
  access   : manage own venue, listings, bookings,
             record matches, redeem vouchers

Match Admin
  username : matchadmin
  password : match1234
  access   : edit scores, verify matches,
             manage tournament participants
─────────────────────────────────────────────
""")
