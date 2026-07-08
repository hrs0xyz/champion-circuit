---
inclusion: always
---

# MAXX — Champion Circuit Full Project Memory

> This file is the single source of truth for AI assistants (Kiro) working on Champion Circuit.
> Read this first before touching any code.

---

## What is Champion Circuit?

**India's first integrated youth sports & gaming ecosystem.**

One platform that does three things:
1. **Turf booking** — book cricket, badminton, football etc. slots at maintained venues
2. **Esports** — register for BGMI, Valorant, FIFA etc. tournaments
3. **Vouchers** — buy discount vouchers from partner venues

Target: urban Indian youth (18–30) in metros — Kolkata, Mumbai, Delhi, Bangalore.

---

## Repo Location

```
/Users/himanshusingh/Documents/championcircuit/championcircuit/
├── backend/       ← FastAPI (Python 3.14)
└── frontend/      ← React 18 + TypeScript + Vite 5
```

**Git**: `main` branch. Always commit to main. Push only when Himanshu says "ok push".

---

## Tech Stack

| Layer | Tech |
|---|---|
| Frontend | React 18, TypeScript, Vite 5, React Router v7 |
| Styling | Custom CSS — dark navy (#060d1a) / teal (#0abfbc) theme. NO Tailwind. All CSS in `frontend/src/index.css` |
| Fonts | Newsreader (serif, headings/display) + DM Sans (body) — Google Fonts |
| Backend | Python 3.14, FastAPI, SQLAlchemy 2.x |
| Database | PostgreSQL (Neon) in production. SQLite for local dev |
| Auth | JWT (email/password + Google OAuth). Token in `localStorage` as `cc_token` |
| OTP | 6-digit via Gmail SMTP |
| File uploads | Cloudinary (avatars + news images + listing photos) |
| Payments | Razorpay |
| Deployment | Backend: Render. Frontend: Vercel |
| Backend URL | https://champion-circuit.onrender.com |
| Frontend URL | https://champion-circuit-delta.vercel.app |

---

## Running Locally

```bash
# Backend
cd /Users/himanshusingh/Documents/championcircuit/championcircuit/backend
source .venv/bin/activate
uvicorn app.main:app --reload
# → http://127.0.0.1:8000

# Frontend (separate terminal)
cd /Users/himanshusingh/Documents/championcircuit/championcircuit/frontend
npm run dev
# → http://127.0.0.1:5173
```

**Local `.env`** — `frontend/.env` should point to local backend:
```
VITE_API_URL=http://127.0.0.1:8000
```
For production deploy, change to `https://champion-circuit.onrender.com`.

---

## Database

- **Production**: Neon PostgreSQL (credentials in `backend/.env`)
- **Local**: SQLite at `backend/champion_circuit.db`
- **No Alembic** — migrations are hand-rolled in `backend/app/db/migrations.py`, runs idempotently on every startup
- **Migration ran** for `news_articles` columns: `body`, `cover_url`, `summary`, `tags`, `published_at`, `slug`, `category` — all widened from `VARCHAR(30)` to `TEXT`/larger `VARCHAR` via `_ensure_postgres_schema()`

### Seed scripts (run once after clone)
```bash
python seed_categories.py   # 24 sport/game categories
python seed_all.py           # admin + turf owner + demo venue + match admin
python seed_demo.py          # demo voucher partner
```

---

## User Roles & Staff Portals

All roles use the same `/staff-login` URL. Auto-redirect by role after login.

| Role | DB flag | Portal | Login |
|---|---|---|---|
| Regular user | (none) | N/A | `/login` |
| Turf Owner | `is_venue_owner=True` | `/staff/venue` | `/staff-login` or `/partner-login` |
| Match Admin | assigned to tournament | `/staff/match` | `/staff-login` |
| Super Admin | `is_admin=True` | `/staff/admin` | `/staff-login` |

**Staff portal CSS class**: `staff-shell` (sidebar + main grid)

**Known accounts on Neon DB**:
- `paperwithcode` — Super Admin (is_admin=True)
- `champdevelopers456` — Turf Owner (is_venue_owner=True)

---

## Frontend Structure

```
frontend/src/
├── App.tsx                    ← All routes
├── index.css                  ← ALL CSS (8000+ lines, single file)
├── context/
│   ├── AuthContext.tsx         ← JWT state (user, setToken, signOut, refreshUser)
│   ├── CityContext.tsx         ← Multi-city filter (localStorage)
│   └── PlatformContext.tsx     ← Legacy local data
├── lib/
│   ├── api.ts                  ← Auth + profile API client
│   ├── ccApi.ts                ← All new endpoints (venues, news, matches, tournaments)
│   └── voucherApi.ts           ← Voucher API
├── pages/
│   ├── LandingPage.tsx
│   ├── AboutPage.tsx           ← "About Champion Circuit" + FoundersSection
│   ├── NewsPage.tsx            ← /news (list) + /news/:id (article)
│   ├── TurfBrowsePage.tsx      ← Browse venues
│   ├── VenueDetailPage.tsx     ← Venue + listings
│   ├── EsportsBrowsePage.tsx
│   ├── LeaderboardPage.tsx
│   ├── VouchersPage.tsx
│   └── staff/
│       ├── StaffLoginPage.tsx  ← /staff-login + /partner-login alias
│       ├── SuperAdminPage.tsx  ← /staff/admin — full control including News CRUD
│       ├── TurfOwnerPage.tsx   ← /staff/venue — venue management
│       └── MatchAdminPage.tsx  ← /staff/match
└── components/
    ├── sections/
    │   ├── FoundersSection.tsx ← Team + Advisors on About page
    │   └── ClientsSection.tsx  ← "Brands & Partners" marquee on Landing
    └── ui/
        ├── NewsEditor.tsx      ← Rich text editor (cover upload + body editor)
        └── ...
```

---

## Backend Structure

```
backend/app/
├── main.py                     ← FastAPI app, all routers registered
├── core/
│   ├── config.py               ← Settings (all env vars)
│   └── security.py             ← JWT + bcrypt
├── db/
│   ├── session.py              ← Engine + SessionLocal + Base
│   └── migrations.py           ← Hand-rolled idempotent migrations
├── models/
│   ├── user.py                 ← User, EmailOtp
│   ├── venue.py                ← Venue, Listing, Booking, Slots, Photos, Amenities
│   ├── match.py                ← Match, Tournament, Team, NewsArticle, Notification
│   ├── voucher.py              ← Partner, VoucherListing, VoucherOrder, IssuedVoucher
│   └── waitlist.py
├── schemas/
│   ├── match.py                ← NewsCreate.body max_length=500000 (was 50000, raised)
│   └── ...
├── services/
│   └── match.py                ← create_news, list_news, publish_news, serialize_news
└── api/routes/
    ├── auth.py
    ├── admin.py                ← /api/admin/* + /api/staff/*
    ├── matches.py              ← /api/news/*, /api/tournaments/*, /api/leaderboard
    ├── venues.py               ← /api/venues/*, /api/listings/*, /api/bookings/*
    ├── uploads.py              ← /api/uploads/avatar + /api/uploads/news-image (NEW)
    └── health.py
```

---

## What Was Built in This Session (July 8, 2026)

### About Page
- "urban players" → "Players" in first paragraph
- `FoundersSection.tsx`: updated Saptarshee, Priyanka, Sayantan bios
- Advisor section subtitle: "Guided by leader…" (removed "s")

### Brands & Partners (Landing Page `ClientsSection.tsx`)
- Heading: "Brands & **Partners**" (capital P)
- Marquee shows IIM Calcutta + IIT (BHU) Varanasi logos with `mix-blend-mode: screen`
- Logo files: `frontend/public/branding/IIMcalcuta.png`, `IITbhu.png` (RGBA PNGs)

### `.01 .02 .03 .04` Numbers (LandingInfoSection)
- Changed from `ui-monospace` → `Newsreader` serif italic `font-weight: 300`

### News System (Major Feature)
**Backend**:
- `GET /api/admin/news` — admin-only, returns all articles including drafts
- `DELETE /api/news/{id}` — admin-only, hard delete
- `POST /api/uploads/news-image` — Cloudinary upload, admin-only, returns `{url}`
- `NewsCreate.body` max_length raised to 500,000 chars
- Migration in `_ensure_postgres_schema()` widens `news_articles` VARCHAR columns to TEXT

**Frontend**:
- `CoverImagePicker` component — file picker → Cloudinary → inline preview
- `BodyEditor` component — contentEditable rich editor with toolbar (B/I/H2/H3/blockquote/lists/link/image)
  - Insert image: uploads to `/api/uploads/news-image`, inserts `<figure class="news-body-img">` at cursor
  - After image: cursor goes into `figcaption` (editable italic caption)
  - Press Enter in caption → exits to normal `<p>` below figure
  - Press Enter again → normal paragraph break
  - Paste strips formatting (plain text only)
  - Uses `useEffect` on mount to set initial HTML (NOT `dangerouslySetInnerHTML` — that was the backward-typing bug)
- `AdminNews` in `SuperAdminPage.tsx` has full CRUD:
  - **+ New article** → create form
  - **Edit** → pre-fills form with article content, saves via `PUT /api/news/{id}`
  - **Delete** → `window.confirm` → `DELETE /api/news/{id}`
  - **Publish** / **Unpublish** toggle
  - Draft articles shown with "Draft" badge
  - Article list loads from `/api/admin/news` (includes drafts)

**Public News Page** (`NewsPage.tsx`):
- No cover → shows CC logo (`/branding/cc-mark.png`) centered, dimmed
- Articles ordered by `created_at` DESC (newest first)
- In-article images: `figure.news-body-img` centered, full width, max 480px height
- Captions: italic, `font-weight: 600`, 13px, muted color

### CSS Key Classes Added
```css
/* News form */
.news-form, .news-form__field, .news-form__label, .news-form__row, .news-form__footer
/* Cover picker */
.news-cover-picker, .news-cover-picker__zone, .news-cover-picker__preview
.news-cover-picker__img, .news-cover-picker__remove
/* Body editor */
.news-editor, .news-editor__toolbar, .news-editor__tool, .news-editor__body
.news-editor__sep, .news-editor__err
/* Figure/caption */
figure.news-body-img, .news-body-caption
/* Article list */
.news-list-thumb
/* Staff buttons */
.staff-action-btn--danger, .staff-msg--err
/* News placeholder */
.news-card__img-placeholder-logo
```

---

## Key CSS Variables & Design Tokens

```css
--navy-deep: #060d1a      /* page background */
--teal: #0abfbc           /* primary accent */
--silver: #e8e8e8         /* headings */
--text: rgba(255,255,255,0.88)
--text-muted: rgba(255,255,255,0.5)
--font: 'Newsreader', Georgia, serif    /* display/headings */
--font-body: 'DM Sans', system-ui      /* body text */
--radius: 14px
```

---

## Important Patterns & Rules

1. **Never use `dangerouslySetInnerHTML` on a live `contentEditable`** — it causes React to overwrite the DOM on every keystroke, reversing text direction. Use `useEffect` to set `innerHTML` once on mount.

2. **RGBA logo images on dark background** — use `mix-blend-mode: screen`, NOT `filter: invert()`. Invert breaks colored logos.

3. **No Alembic** — add column migrations manually to `backend/app/db/migrations.py` → `_ensure_postgres_schema()`. Always idempotent (check type before altering).

4. **Staff portals are hidden** — no public links. URL typed directly: `/staff-login` or `/partner-login` (alias).

5. **Two frontend API clients**:
   - `api.ts` → auth + profile
   - `ccApi.ts` → everything else (venues, news, matches, tournaments)
   - `adminReq()` in `SuperAdminPage.tsx` → raw fetch with admin token

6. **JWT in `localStorage`** as `cc_token`. All requests: `Authorization: Bearer <token>`.

7. **`published_at` column** is `VARCHAR(50)` — it stores ISO datetime strings like `2026-07-07T19:40:12.353269+00:00`. The migration widens it from the broken `VARCHAR(30)`.

8. **News article ordering**: newest `created_at` first (default from `list_news` service).

9. **Capacity field** (`listings.capacity`) is `VARCHAR(20)` — stores strings like `"10"` or `"5-10"`. Was `INTEGER`, migrated.

---

## Founders & Team (for About page — exact bios)

| Name | Role | Bio |
|---|---|---|
| Puspal Bag | CEO, Director & Founder | Former Director at Lets Game Now. 10+ years eSports. Represented India in eFIBA Season 1 & 2. |
| Priyanka Mondal | CDO, Co-Founder & Director | Ex-Assistant Operation Manager at Lets Game Now. 5+ Years esports. Hosted Asian Games India Qualifier 2022 (FIFA 22) & 2026 & eISL 2024. |
| Sayantan Hait | CGO & Co-Founder | Ex-eSports Manager at Lets Game Now. 7+ Years eSports. Hosted Asian Games India Qualifier 2022 (FIFA 22) & 2026 & eISL 2024, GEG 2026. |
| Chaitradip Sarkar | COO & Co-Founder | Ex-STAN, W2 (Hashed Emergent Group), KGeN, Rooter. 7+ years growth/GTM/ecosystem strategy across gaming, esports, Web3. |
| Saptarshee Ghosh | Head of Marketing | 6+ years in Growth, Marketing & Creative Strategy. Worked with renowned brands. Recognized by Pinewood Studios, featured in PCI. |
| Arnab Mandal | Advisor | Polymath with 16+ years experience. London Business School Executive Education, Leadership. |

---

## Partner Logos

Located at `frontend/public/branding/`:
- `IIMcalcuta.png` — 529×554 RGBA PNG
- `IITbhu.png` — 540×552 RGBA PNG
- `cc-mark.png` — CC logo mark (used as news fallback)
- `cc-full.png`, `cc-banner.png`, `cc-square.png`

---

## Points Formula

```
casual match:     win=3, draw=2, loss=1
ranked match:     win=10, draw=2, loss=1
tournament match: win=20 × 1.5 = 30, draw=2, loss=1
verified venue:   × 1.2 bonus
Tournament placement: 1st=+50, 2nd=+30, 3rd=+15
```

---

## What Still Needs Doing (Known Backlog)

2. LISTING VENUES 
3. SEND INQUIRY
---

## What NOT To Do

- Do NOT change the `.env` files without asking
- Do NOT push to git until Himanshu says "ok push"  
- Do NOT use Tailwind or any CSS framework — everything is custom CSS
- Do NOT add npm packages without asking (project is intentionally minimal deps)
- Do NOT use Firebase for auth — it was removed, JWT is the auth layer
