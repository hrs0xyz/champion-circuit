# Champion Circuit — Complete Project Guide
> For developers, AI assistants (Kiro), and human contributors.
> Last updated: June 2026

---

## What is Champion Circuit?

Champion Circuit is **India's first integrated youth sports & gaming ecosystem**.

It connects three things in one platform:
1. **Physical sports** — book turf slots for cricket, badminton, football etc.
2. **Esports** — register for tournaments in Valorant, BGMI, FIFA etc.
3. **Vouchers** — buy discount vouchers for venues, food, merchandise

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript + Vite 5 |
| Routing | React Router v7 |
| Styling | Custom CSS (dark navy/teal theme, no Tailwind) |
| Backend | Python 3.14 + FastAPI |
| Database | SQLite (local) → PostgreSQL/RDS (production) |
| Auth | JWT (email/password + Google OAuth) |
| OTP | 6-digit code via Gmail SMTP |
| Payments | Razorpay (UPI, cards, wallets) |
| QR codes | Python `qrcode` library |
| Maps | Google Maps (external link, no embed key needed) |

---

## Project Structure

```
championcircuit/
├── backend/                              ← FastAPI server
│   ├── app/
│   │   ├── main.py                       ← App entry, all routes registered
│   │   ├── core/
│   │   │   ├── config.py                 ← All env var settings
│   │   │   └── security.py               ← JWT + password hashing
│   │   ├── db/
│   │   │   ├── session.py                ← SQLAlchemy engine + Base
│   │   │   └── migrations.py             ← SQLite column migrations (idempotent)
│   │   ├── models/                       ← Database table definitions
│   │   │   ├── user.py                   ← User, EmailOtp
│   │   │   ├── venue.py                  ← Venue, Listing, Booking, Slots, Photos
│   │   │   ├── match.py                  ← Match, Tournament, Team, News, Notifications
│   │   │   ├── voucher.py                ← Partner, VoucherListing, VoucherOrder, IssuedVoucher
│   │   │   └── waitlist.py               ← WaitlistEntry (landing page early access)
│   │   ├── schemas/                      ← Pydantic request/response models
│   │   │   ├── auth.py                   ← Login, Signup, OTP, Profile
│   │   │   ├── user.py                   ← UserRead
│   │   │   ├── venue.py                  ← Venue, Listing, Booking schemas
│   │   │   ├── match.py                  ← Match, Tournament, Team, News schemas
│   │   │   └── voucher.py                ← Voucher checkout, redeem schemas
│   │   ├── services/                     ← Business logic
│   │   │   ├── users.py                  ← User CRUD, OTP, Google auth
│   │   │   ├── venue.py                  ← Venue/listing/booking logic
│   │   │   ├── match.py                  ← Match recording, scoring, leaderboard, news
│   │   │   ├── voucher.py                ← Voucher generation, QR, Razorpay
│   │   │   └── email.py                  ← SMTP email (OTP, voucher delivery)
│   │   └── api/routes/                   ← HTTP endpoints
│   │       ├── auth.py                   ← /api/auth/*
│   │       ├── users.py                  ← /api/users/me
│   │       ├── venues.py                 ← /api/venues/*, /api/listings/*, /api/bookings/*
│   │       ├── matches.py                ← /api/matches/*, /api/tournaments/*, /api/leaderboard
│   │       ├── vouchers.py               ← /api/vouchers/*, /api/waitlist
│   │       ├── admin.py                  ← /api/admin/*, /api/staff/*
│   │       ├── uploads.py                ← /api/uploads/avatar
│   │       └── health.py                 ← /api/health
│   ├── .env                              ← Secrets (NOT committed to git)
│   ├── .env.example                      ← Template for teammates
│   ├── requirements.txt
│   ├── seed_categories.py                ← Run once: seeds 24 sport/game categories
│   ├── seed_demo.py                      ← Run once: seeds demo voucher partner
│   └── seed_all.py                       ← Run once: seeds admin/turf/matchadmin + demo venue
│
└── championCircuit-main-froneend-old-code/   ← React frontend
    ├── src/
    │   ├── App.tsx                        ← All routes defined here
    │   ├── main.tsx                       ← React entry point
    │   ├── index.css                      ← All global CSS (teal/navy theme)
    │   ├── context/
    │   │   ├── AuthContext.tsx            ← JWT auth state (user, setToken, signOut)
    │   │   ├── CityContext.tsx            ← Multi-city filter state (persisted localStorage)
    │   │   └── PlatformContext.tsx        ← Local tournament/turf seed data (legacy)
    │   ├── lib/
    │   │   ├── api.ts                     ← Auth API client (login, signup, profile)
    │   │   ├── ccApi.ts                   ← All new backend endpoints (venues, matches, news)
    │   │   └── voucherApi.ts              ← Voucher-specific API calls
    │   ├── pages/
    │   │   ├── LandingPage.tsx            ← Hero + early access form
    │   │   ├── LoginPage.tsx              ← Email/username + password login
    │   │   ├── SignupPage.tsx             ← Username/email/password → OTP → account
    │   │   ├── ForgotPasswordPage.tsx     ← Identifier → OTP → new password
    │   │   ├── TurfBrowsePage.tsx         ← Browse venues with sport + city filter
    │   │   ├── VenueDetailPage.tsx        ← Venue info + listings with photo carousel
    │   │   ├── EsportsBrowsePage.tsx      ← Tournament browse + register
    │   │   ├── LeaderboardPage.tsx        ← Live leaderboard from backend
    │   │   ├── VouchersPage.tsx           ← Buy vouchers + checkout
    │   │   ├── MyVoucherPage.tsx          ← Guest lookup CC-XXXX-XXXX
    │   │   ├── NewsPage.tsx               ← News feed + article view
    │   │   ├── ProfilePage.tsx            ← View/edit profile, avatar upload
    │   │   ├── MyMatchesPage.tsx          ← Match history + points
    │   │   └── staff/
    │   │       ├── StaffLoginPage.tsx     ← Hidden login at /staff-login
    │   │       ├── SuperAdminPage.tsx     ← /staff/admin — full control
    │   │       ├── TurfOwnerPage.tsx      ← /staff/venue — venue management
    │   │       └── MatchAdminPage.tsx     ← /staff/match — score recording
    │   └── components/
    │       └── ui/
    │           ├── Navbar.tsx             ← Site navigation
    │           ├── CityBar.tsx            ← City filter chips (All, Kolkata, Mumbai...)
    │           ├── FloatingNotifications.tsx ← Fixed bottom-right bell icon
    │           └── OtpInput.tsx           ← 6-box OTP input
    └── .env                               ← VITE_API_URL=http://127.0.0.1:8000
```

---

## How to Run Locally

### Prerequisites
- Python 3.12+ with pip
- Node.js 18+

### Backend
```bash
cd backend

# First time only
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env
# Edit .env and add your SMTP app password

# Seed data (first time only)
.venv/bin/python seed_categories.py   # 24 sport/game categories
.venv/bin/python seed_all.py          # admin + turf owner + demo venue
.venv/bin/python seed_demo.py         # demo voucher partner

# Start (every time)
.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
→ http://127.0.0.1:8000 | API docs: http://127.0.0.1:8000/docs

### Frontend
```bash
cd championCircuit-main-froneend-old-code

# First time only
npm install
cp .env.example .env   # already has VITE_API_URL=http://127.0.0.1:8000

# Start (every time)
npm run dev
```
→ http://127.0.0.1:5173

---

## Environment Variables

### `backend/.env`

```env
APP_NAME=Champion Circuit API
ENVIRONMENT=local           # local = OTP shown in API response; production = email only
SECRET_KEY=random-string    # JWT signing key — change before deploy
DATABASE_URL=sqlite:///./champion_circuit.db

# Gmail SMTP — use App Password (not your real password)
# Generate at: myaccount.google.com → Security → App passwords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=championcircuit1@gmail.com
SMTP_PASSWORD=your-16-char-app-password

GOOGLE_CLIENT_ID=            # From Google Cloud Console (for Google login)
RAZORPAY_KEY_ID=             # From dashboard.razorpay.com
RAZORPAY_KEY_SECRET=
```

### `frontend/.env`
```env
VITE_API_URL=http://127.0.0.1:8000   # Change to your server URL in production
```

---

## Roles & Access Control

There are **4 account types**. They all use the same login system — roles are flags on the `users` table.

```
┌─────────────────────────────────────────────────────────────────┐
│                    ACCOUNT TYPES                                  │
├────────────────┬────────────────────┬──────────────────────────┤
│ Type           │ DB flags           │ Login URL                 │
├────────────────┼────────────────────┼──────────────────────────┤
│ Regular User   │ (none)             │ /login                    │
│ Turf Owner     │ is_venue_owner=True│ /staff-login → /staff/venue│
│ Match Admin    │ (assigned to tourney)│ /staff-login → /staff/match│
│ Super Admin    │ is_admin=True      │ /staff-login → /staff/admin│
└────────────────┴────────────────────┴──────────────────────────┘
```

### Role Details

#### 1. Regular User
- Signs up via `/signup` (username + email + password + OTP)
- Can: browse venues, book slots, register for tournaments, buy vouchers, view leaderboard
- Profile: name, city, avatar, interests, bio
- Login: `/login` (email or username + password)

#### 2. Turf Owner (`is_venue_owner=True`)
- Created by Super Admin via `/staff/admin` → Users → "Create account"
- First login: receives credentials, goes to `/staff-login`, auto-redirected to `/staff/venue`
- Can:
  - View and edit own venue details
  - Create listings (Cricket, Badminton, PlayStation etc.) with up to 5 photos each
  - View all bookings for their venue
  - See tournaments held at their venue
  - **Assign match admin** to any tournament at their venue

#### 3. Match Admin (assigned per tournament, NOT a separate account type)
- Any user can be assigned as match admin for a specific tournament
- Assignment done by: Super Admin OR Turf Owner (for their own tournaments)
- After assignment, when they log in → `/staff-login` → auto-redirected to `/staff/match`
- Can (for their assigned tournaments only):
  - View all registered participants
  - Record matches (select players, set results, scores, kills/assists/deaths)
  - Edit match scores before verification
  - Verify matches → this triggers automatic points calculation and awards
  - Change tournament status (live → completed etc.)

#### 4. Super Admin (`is_admin=True`)
- Default credentials: `admin / admin` (change before production)
- Access: `/staff-login` → `/staff/admin`
- Can do everything:
  - **Users**: search all users, create staff accounts, reset any password, ban/unban
  - **Venues**: verify venues (grants ✓ Verified badge), suspend/activate venues
  - **Tournaments**: create tournaments, assign match admins, change status, record results
  - **News**: write and publish articles (esports, sports, general, announcements)
  - **Vouchers**: view all issued vouchers
  - **Leaderboard**: manually adjust any player's points with a reason (audit trail)
  - **Score adjustments**: +/- points for any user, logged permanently

---

## How the Website Works — End to End

### A. User signs up

```
User visits /signup
  → types username (4-16 chars, letters/numbers/_ only)
  → live availability check via GET /api/auth/username/{username}
  → enters email + password
  → clicks Continue
    → POST /api/auth/signup/start
      → backend generates 6-digit OTP
      → sends OTP to email via Gmail SMTP
      → if ENVIRONMENT=local: also returns otp in API response
  → user enters 6 OTP boxes
  → clicks Verify
    → POST /api/auth/signup/verify
      → backend validates OTP (10 min expiry, max 5 attempts)
      → creates user in DB with blank profile
      → returns JWT token
  → frontend stores token in localStorage
  → user redirected to / (home)
```

### B. User books a turf slot

```
/turf page
  → loads all venues from GET /api/venues
  → city filter (All / Kolkata / Mumbai...) — stored in localStorage
  → sport filter (Cricket 🏏 / Badminton 🏸 / PS5 🎮...) — filter chips
  → user clicks a venue card
    → 🗺 Maps button → opens Google Maps in new tab
    → 📞 Call button → opens phone dialer

/venue/:id page
  → loads venue detail + listings from GET /api/venues/:id
  → shows listing cards with photo carousel (up to 5 photos per listing)
  → each card shows: category, price per hour, capacity, amenities, duration
  → "Book now" button → if not logged in, redirects to /login
  → if logged in → /book/:listing_id (booking flow)
```

### C. Tournament registration

```
/esports page
  → fetches tournaments from GET /api/tournaments
  → tab filter: All / Open (registration) / Live / Completed
  → tournament card shows: game, format, mode, entry fee, prize pool
  → "Register" button
    → POST /api/tournaments/:id/register
    → adds user to tournament_registrations table
    → user gets notification: "Registered for [tournament name]"
```

### D. Voucher purchase

```
/vouchers page
  → loads listings from GET /api/vouchers
  → city filter applies (filter by partner's city)
  → "Buy now" click → CheckoutModal opens
  → user enters email, name, phone
  → if free (price=0): voucher issued immediately
  → if paid:
    → POST /api/vouchers/checkout
    → backend creates Razorpay order
    → Razorpay payment modal opens (UPI/card/wallet)
    → on payment success → POST /api/vouchers/payment/verify
    → backend verifies Razorpay signature
    → issues unique code CC-XXXX-XXXX
    → generates QR SVG (inline, no external service)
    → sends delivery email to buyer
    → code + QR shown on screen

Guest (no login needed for Phase 3):
  → partner shares link: /vouchers?ref=PARTNER_TOKEN
  → guest buys without account
  → POST /api/vouchers/checkout/guest
  → gets code by email
  → can look up later at /my-voucher → enter CC-XXXX-XXXX

Redemption at venue:
  → staff scans QR or enters code
  → POST /api/vouchers/redeem (venue staff auth required)
  → marks voucher as "redeemed"
```

### E. Match recording and points

```
Match Admin logs in → /staff/match
  → sees assigned tournaments
  → clicks a tournament → Participants tab (all registered players)
  → "Record match" tab
  → selects players, sets results (win/loss/draw/dnf) and scores
  → submits → POST /api/matches (creates match with status "scheduled")

  → "Matches" tab → sees recorded matches
  → clicks "Verify & award points"
    → POST /api/staff/matches/:id/verify
    → backend calculates points:
        casual win  = 3 pts
        ranked win  = 10 pts
        tournament win = 20 pts × 1.5 = 30 pts
        draw = 2 pts, loss = 1 pt
    → writes points_earned to match_participants table
    → sends notification to each player: "+X points from match"

/leaderboard page
  → GET /api/leaderboard?scope_type=global&period_type=all_time
  → real-time computation from match_participants + score_adjustments
  → user's own row highlighted with "You" badge
  → period selector: All time / Monthly / Weekly
```

### F. News publishing

```
Super Admin → /staff/admin → News tab
  → clicks "+ New article"
  → fills: title, summary, body, cover image URL, category, tags
  → "Publish immediately" checkbox OR save as draft
  → POST /api/news

/news page (public)
  → GET /api/news (published only)
  → category filter chips (esports, sports, general, announcement)
  → click article → /news/:id → full article view, view count incremented
```

---

## Database Tables (28 tables)

```
Auth & Users:
  users               — all accounts (players, turf owners, admins)
  email_otps          — OTP codes (signup + password reset)

Venues & Listings:
  listing_categories  — 24 categories (cricket, valorant, food, etc.)
  venues              — turf/gaming club businesses
  venue_admins        — staff attached to a venue (owner/manager/staff)
  listings            — one activity per listing (cricket turf, PS5 pod)
  listing_photos      — up to 5 photos per listing
  listing_amenities   — tags: Floodlit, AC, WiFi etc.
  listing_slots       — recurring time windows
  bookings            — slot reservations

Matches & Scoring:
  matches             — recorded matches
  match_participants  — every player in a match with result + score + points
  score_adjustments   — admin manual +/- point overrides (with reason)
  leaderboard_snapshots — pre-computed snapshots (future caching)

Tournaments & Teams:
  tournaments         — tournament events
  tournament_admins   — match admin assignments per tournament
  tournament_registrations — who registered
  tournament_results  — final positions + prize + points
  teams               — player groups
  team_members        — who's in which team
  team_invites        — pending invitations

Content & Communication:
  news_articles       — articles pushed by admin
  notifications       — in-app notifications per user
  reviews             — venue/listing ratings (1-5 stars)

Vouchers:
  partners            — venues/brands offering vouchers
  voucher_listings    — what's for sale (discount, free slot, food, etc.)
  voucher_orders      — purchase records (logged in or guest)
  issued_vouchers     — unique CC-XXXX-XXXX codes
  waitlist_entries    — early access sign-ups from landing page
```

---

## API Endpoints Summary

```
Auth:
  POST /api/auth/signup/start     → send OTP
  POST /api/auth/signup/verify    → verify OTP → JWT
  POST /api/auth/login            → email/username + password → JWT
  POST /api/auth/password/forgot  → send reset OTP
  POST /api/auth/password/reset   → reset password
  POST /api/auth/google           → Google ID token → JWT
  GET  /api/auth/me               → current user (requires JWT)
  GET  /api/auth/username/:u      → check availability

Users:
  PUT  /api/users/me              → update profile (password required)
  POST /api/uploads/avatar        → upload avatar image

Venues & Listings (public):
  GET  /api/categories            → all 24 listing categories
  GET  /api/venues                → browse venues (city filter)
  GET  /api/venues/:id            → venue + listings detail
  GET  /api/listings/:id          → single listing

Venues & Listings (staff):
  POST /api/venues                → create venue (venue owner)
  PUT  /api/venues/:id            → update venue
  POST /api/venues/:id/listings   → add listing
  POST /api/listings/:id/photos   → upload photo (max 5)
  POST /api/listings/:id/amenities → set amenity tags
  POST /api/listings/:id/slots    → add time slot

Bookings:
  POST /api/bookings              → book a slot (auth required)
  GET  /api/bookings/me           → my bookings

Matches & Scoring:
  POST /api/matches               → record match (venue staff)
  GET  /api/matches               → list matches
  GET  /api/matches/me            → my match history
  POST /api/matches/:id/verify    → verify match + award points (admin)
  GET  /api/leaderboard           → ranked players (scope/period filters)
  POST /api/scores/adjust         → admin point adjustment

Tournaments:
  GET  /api/tournaments           → browse tournaments
  GET  /api/tournaments/:id       → tournament detail
  POST /api/tournaments           → create tournament (admin)
  PUT  /api/tournaments/:id       → update tournament (admin)
  POST /api/tournaments/:id/register      → register (auth)
  POST /api/tournaments/:id/results       → record results (admin)

Teams:
  POST /api/teams                 → create team
  GET  /api/teams/me              → my teams
  POST /api/teams/:id/invite      → invite by email

News:
  GET  /api/news                  → published articles
  GET  /api/news/:id              → single article
  POST /api/news                  → create article (admin)
  PUT  /api/news/:id              → edit article (admin)
  POST /api/news/:id/publish      → publish draft (admin)

Notifications:
  GET  /api/notifications         → my notifications
  POST /api/notifications/read    → mark all read

Vouchers:
  GET  /api/vouchers              → browse listings
  POST /api/vouchers/checkout     → buy voucher (auth optional)
  POST /api/vouchers/checkout/guest → guest purchase
  POST /api/vouchers/payment/verify → confirm Razorpay payment
  GET  /api/vouchers/my/list      → my vouchers
  POST /api/vouchers/lookup       → guest code lookup
  POST /api/vouchers/redeem       → redeem at venue (staff)
  POST /api/waitlist              → early access sign-up

Admin & Staff:
  GET  /api/admin/stats           → dashboard counts
  GET  /api/admin/users           → all users (search/filter)
  PUT  /api/admin/users/:id       → edit user
  PUT  /api/admin/users/:id/password → reset password
  POST /api/admin/users           → create staff account
  GET  /api/admin/venues          → all venues
  POST /api/admin/venues/:id/verify   → grant verified badge
  POST /api/admin/venues/:id/suspend  → suspend venue
  POST /api/admin/tournaments/:id/assign-match-admin
  GET  /api/staff/my-venue        → turf owner's venue data
  GET  /api/staff/my-tournaments  → turf owner's tournaments
  GET  /api/staff/tournaments/:id/participants
  GET  /api/staff/tournaments/:id/matches
  PUT  /api/staff/matches/:id     → edit match scores
  POST /api/staff/matches/:id/verify → verify + award points
```

---

## Points Formula (Leaderboard)

```python
# Base points by match result + type
casual match:     win=3,  draw=2, loss=1
ranked match:     win=10, draw=2, loss=1
tournament match: win=20, draw=2, loss=1

# Multipliers applied on top of base
tournament match: × 1.5   (so tournament win = 30 pts)
verified venue:   × 1.2   (match at CC-verified venue)

# Tournament placement bonuses (added separately)
1st place: +50 pts
2nd place: +30 pts
3rd place: +15 pts

# Admin can manually adjust via score_adjustments table
# All adjustments are logged with reason and admin ID
```

---

## Staff Portals

The staff section is **intentionally hidden** — no links from the public site.

| URL | Who accesses it | How to reach it |
|---|---|---|
| `/staff-login` | Super Admin, Turf Owner, Match Admin | Type URL directly |
| `/staff/admin` | Super Admin only | Auto-redirect after login |
| `/staff/venue` | Turf Owner | Auto-redirect after login |
| `/staff/match` | Match Admin (assigned) | Auto-redirect after login |

**Default credentials (change before production):**
```
Super Admin:   admin       / admin
Turf Owner:    turfowner   / turf1234
Match Admin:   matchadmin  / match1234
```

**How match admin assignment works:**
1. Super admin OR turf owner goes to their staff portal
2. Finds the tournament they want to assign
3. Clicks "Assign match admin" → types `@username`
4. That user now has match admin access to that tournament
5. Next time they log in → automatically redirected to `/staff/match`

---

## Key Relationships

```
User ──────────────────── books ──────────────────── Booking
  │                                                      │
  ├── is Turf Owner of ────────────── Venue              │
  │                                     │                │
  ├── is Match Admin for ─── TournamentAdmin             │
  │                                     │                │
  ├── participates in ──── MatchParticipant ──── Match   │
  │                                     │         │      │
  ├── registers for ─── TournamentRegistration   │      │
  │                                     │         │      │
  ├── is in ──────────── TeamMember ─── Team     │      │
  │                                              │      │
  └── earns ──────────── points_earned ──────────┘      │
                              │                          │
                              └── ScoreAdjustment        │
                                  (admin override)        │
                                                         │
Venue ──────────── has ──────────── Listing              │
  │                                   │                  │
  │                             ListingSlot              │
  │                                   │                  │
  │                             Booking ←────────────────┘
  │
  └── hosts ──── Tournament
                     │
              TournamentAdmin (match admin assignment)
                     │
              TournamentRegistration (players)
                     │
              TournamentResult (final positions + prizes)
```

---

## Notes for Kiro (AI Assistant)

When working on this codebase, keep in mind:

1. **Python version is 3.14** — avoid `Optional[X]` and `X | None` in SQLAlchemy `Mapped[]` columns. Use non-nullable types or avoid nullable datetimes in model definitions.

2. **No Alembic** — migrations are hand-rolled in `backend/app/db/migrations.py`. When adding columns, add `ALTER TABLE` statements there. The migration runs on every startup (idempotent).

3. **Frontend auth** — JWT token stored in `localStorage` as `cc_token`. All authenticated requests include `Authorization: Bearer <token>`. The `AuthContext` fetches `/api/auth/me` on mount.

4. **Two API clients** — `src/lib/api.ts` handles auth + profile. `src/lib/ccApi.ts` handles all new endpoints (venues, matches, tournaments, news, notifications). `src/lib/voucherApi.ts` handles vouchers.

5. **City filtering** — `CityContext` manages multi-select city state in localStorage. `matchesCity(city)` returns true if city passes the current filter. `CityBar` component shows the chips.

6. **Staff portals** — located at `/staff-login`, `/staff/admin`, `/staff/venue`, `/staff/match`. These are standalone full-screen pages (not wrapped in `PublicLayout` or `AppLayout`). They have their own sidebar layout called `staff-shell`.

7. **No Firebase** — auth is fully JWT-based. Firebase was removed. The `src/lib/firebase.ts` still exists for legacy 3D model code but is not used for auth.

8. **Seed scripts** — run these once after cloning: `seed_categories.py`, `seed_all.py`, `seed_demo.py`. They are idempotent.

9. **CORS** — backend allows any `localhost:*` or `127.0.0.1:*` port via `allow_origin_regex`. Production should restrict this to the actual domain.

10. **Razorpay dev mode** — if `RAZORPAY_KEY_ID` starts with `rzp_test_REPLACE`, the backend returns a fake `order_DEV_` order ID and skips signature verification. This lets you test the full checkout flow without real keys.
