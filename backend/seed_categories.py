"""
Seed listing categories.
Run once: .venv/bin/python seed_categories.py
"""
import sys
sys.path.insert(0, ".")

from app.db.session import SessionLocal, Base, engine
from app.models.user import User          # noqa
from app.models.venue import ListingCategory
from app.models.match import Match        # noqa
from app.models.voucher import Partner    # noqa
from app.models.waitlist import WaitlistEntry  # noqa

Base.metadata.create_all(bind=engine)

CATEGORIES = [
    # Physical sports
    {"slug": "cricket",       "name": "Cricket",         "type": "physical"},
    {"slug": "football",      "name": "Football",        "type": "physical"},
    {"slug": "badminton",     "name": "Badminton",       "type": "physical"},
    {"slug": "basketball",    "name": "Basketball",      "type": "physical"},
    {"slug": "table_tennis",  "name": "Table Tennis",    "type": "physical"},
    {"slug": "kabaddi",       "name": "Kabaddi",         "type": "physical"},
    {"slug": "tennis",        "name": "Tennis",          "type": "physical"},
    {"slug": "volleyball",    "name": "Volleyball",      "type": "physical"},
    {"slug": "swimming",      "name": "Swimming",        "type": "physical"},
    {"slug": "boxing",        "name": "Boxing / MMA",    "type": "physical"},
    # Esports
    {"slug": "valorant",      "name": "Valorant",        "type": "esports"},
    {"slug": "bgmi",          "name": "BGMI",            "type": "esports"},
    {"slug": "pubg",          "name": "PUBG",            "type": "esports"},
    {"slug": "free_fire",     "name": "Free Fire",       "type": "esports"},
    {"slug": "fifa",          "name": "EA FC / FIFA",    "type": "esports"},
    {"slug": "cod",           "name": "Call of Duty",    "type": "esports"},
    {"slug": "playstation",   "name": "PlayStation",     "type": "esports"},
    {"slug": "pc_gaming",     "name": "PC Gaming",       "type": "esports"},
    {"slug": "chess",         "name": "Chess",           "type": "esports"},
    {"slug": "carrom",        "name": "Carrom",          "type": "esports"},
    # Services / food
    {"slug": "food_beverages","name": "Food & Beverages","type": "food"},
    {"slug": "merchandise",   "name": "Merchandise",     "type": "merchandise"},
    {"slug": "coaching",      "name": "Coaching",        "type": "service"},
    {"slug": "fitness",       "name": "Gym / Fitness",   "type": "service"},
]

db = SessionLocal()

created = 0
for cat in CATEGORIES:
    exists = db.query(ListingCategory).filter(ListingCategory.slug == cat["slug"]).first()
    if not exists:
        db.add(ListingCategory(**cat))
        created += 1

db.commit()
db.close()
print(f"Seeded {created} categories. ({len(CATEGORIES) - created} already existed)")
