"""
Run: python seed_news.py
Seeds 3 sample news articles so the /news page has content to show.
"""
import sqlite3
import json
from datetime import datetime, timezone

DB = "champion_circuit.db"
NOW = datetime.now(timezone.utc).isoformat()

ARTICLES = [
    {
        "title": "Champion Circuit Launches in Kolkata — Book Your Turf Today",
        "slug": "champion-circuit-launches-kolkata",
        "summary": "Champion Circuit is now live in Kolkata, connecting sports enthusiasts with premium turf venues across the city.",
        "body": """Champion Circuit has officially launched in Kolkata, bringing a seamless platform for booking sports venues across the city.

Whether you're looking for a floodlit cricket turf, a professional badminton court, or a PS5 gaming pod, Champion Circuit makes it easy to find and book the perfect venue.

**What's available in Kolkata?**

- Kolkata Central Arena — Cricket, Badminton, PS5 Pods
- Multiple verified venues with transparent pricing
- Instant inquiry via WhatsApp

**How to book**

Simply browse venues, filter by your sport, and tap "Send Inquiry" to connect directly with the venue. No hidden fees.

Join hundreds of players already using Champion Circuit to discover the best sports facilities in their city.""",
        "cover_url": "https://images.unsplash.com/photo-1540747913346-19378ce70f40?w=1200&q=80",
        "category": "announcement",
        "tags": "kolkata,launch,turf,booking",
        "is_published": 1,
        "published_at": NOW,
        "view_count": 0,
        "created_by": 1,
    },
    {
        "title": "Badminton Boom: Why Indoor Courts Are the Next Big Thing",
        "slug": "badminton-boom-indoor-courts",
        "summary": "Badminton has seen a 40% surge in participation across Indian metros. Here's what's driving the trend.",
        "body": """Badminton is having a moment. Across Indian cities, indoor badminton courts are filling up faster than ever — and demand shows no signs of slowing.

**What's driving growth?**

The sport's appeal spans age groups. Unlike cricket or football, badminton can be played in small groups of 2–4, making it perfect for weeknight sessions after work. The physical intensity is high, the equipment cost is low, and courts are increasingly accessible.

**The infrastructure gap**

Despite the surge in interest, quality courts remain scarce. Most facilities are either booked weeks in advance or lack basic amenities like proper lighting, air conditioning, or clean changing rooms.

Champion Circuit is working to fix this by onboarding verified, high-quality venues and making them discoverable to players across the city.

**What to look for in a good court**

- BWF-standard net height (1.55m at edges, 1.524m at center)
- Synthetic or wooden flooring (avoid cement)
- Air conditioning for indoor play
- Good lighting — ideally LED with no shadows

Browse badminton courts near you on Champion Circuit.""",
        "cover_url": "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=1200&q=80",
        "category": "sports",
        "tags": "badminton,sports,indoor,fitness",
        "is_published": 1,
        "published_at": NOW,
        "view_count": 0,
        "created_by": 1,
    },
    {
        "title": "Esports in India: The Rise of Competitive Gaming at Local Venues",
        "slug": "esports-india-local-venues",
        "summary": "From BGMI tournaments to FIFA leagues, local esports is booming at physical venues across India.",
        "body": """India's esports scene has grown dramatically over the past three years. What was once limited to online play is now spilling into physical venues — gaming cafes, sports arenas, and dedicated esports pods.

**The numbers**

India currently has over 300 million mobile gamers, and the competitive gaming segment is the fastest-growing slice of that pie. BGMI, Valorant, and FIFA tournaments are now drawing crowds not just online, but in person.

**What are esports pods?**

Esports pods are dedicated gaming setups at sports venues — high-end PCs or consoles (PS5, Xbox) with large screens, comfortable seating, and fast internet. They can be booked by the hour for casual gaming or reserved for tournaments.

Kolkata Central Arena, one of Champion Circuit's first partner venues, offers PlayStation 5 pods that can be booked directly through the platform.

**What's next**

Champion Circuit is building esports tournament infrastructure — registration, match tracking, leaderboards — all tied to physical venue bookings. Stay tuned for the first Champion Circuit Esports Season.""",
        "cover_url": "https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=80",
        "category": "esports",
        "tags": "esports,bgmi,valorant,fifa,gaming",
        "is_published": 1,
        "published_at": NOW,
        "view_count": 0,
        "created_by": 1,
    },
]

conn = sqlite3.connect(DB)
cur = conn.cursor()

# Get column names
cur.execute("PRAGMA table_info(news_articles)")
cols = {r[1] for r in cur.fetchall()}
print(f"Table columns: {cols}")

inserted = 0
for a in ARTICLES:
    # Check if slug already exists
    cur.execute("SELECT id FROM news_articles WHERE slug = ?", (a["slug"],))
    if cur.fetchone():
        print(f"  Skipping '{a['slug']}' — already exists")
        continue

    # Build insert dynamically based on available columns
    fields = [k for k in a.keys() if k in cols]
    vals = [a[k] for k in fields]
    placeholders = ",".join(["?"] * len(fields))
    cur.execute(
        f"INSERT INTO news_articles ({','.join(fields)}) VALUES ({placeholders})",
        vals,
    )
    inserted += 1
    print(f"  ✓ Inserted: {a['title'][:50]}")

conn.commit()
conn.close()
print(f"\nDone — {inserted} article(s) inserted.")
