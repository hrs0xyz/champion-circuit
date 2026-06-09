# Champion Circuit — Flow Audit (Step 1)

**Date:** 2026-05-27  
**Scope:** Read-only audit before routing/layout refactors.  
**Sources:** Current repo, `Champion Circuit Pitch Deck 1.pdf`, `Champion_Circuit_PRD_v1.0.docx`, and your three-experience brief.

---

## Executive summary

The app is a **single-page Vite + React app with almost no real routing**. Marketing lives at `/`; everything else is crammed into `/platform` inside one **~600-line monolith** (`ChampionCircuitPlatform.tsx`) that mixes **user registration, turf booking, esports, profile/teams, and admin tools** under the **same public header/footer and the same Google login**.

That is the main cohesion failure: there is no spine, no experience boundary, and no canonical URLs for turf/esports/profile/admin.

**Recommendation:** Approve the route map and separation plan below, then implement **three layout shells** + **react-router** (or equivalent) in Step 2—extracting logic from `ChampionCircuitPlatform` into route-level pages, not rewriting features for their own sake.

---

## 1. Current “routes” (effective, not declared)

| URL / state | What renders | Auth | Notes |
|-------------|--------------|------|--------|
| `/` | Landing stack in `App.tsx` | Optional (`SignInModal` → Google) | No Turf/Esports/Leaderboard/About nav links |
| `/platform` | `ChampionCircuitPlatform` | Google required for content | Same `Header`/`Footer` as landing |
| `#top`, `#early-access`, `#landing-features`, `#clients` | Landing anchors | — | Marketing only |
| `#register`, `#book`, `#turf`, `#esports`, `#leaderboard`, `#profile-teams`, `#admin-panel` | Platform scroll targets | Mixed | Not shareable URLs; admin is a hash section |
| *(none)* | `/admin/*`, `/turf`, `/esports`, `/profile`, etc. | — | **Do not exist** |

**Router:** `react-router` is **not installed**. Routing is:

```ts
// App.tsx — only branch
const [isPlatformView] = useState(() => window.location.pathname === '/platform');
// + manual pushState on sign-in / sign-out
```

**Dead ends / confusing flows**

| Flow | What happens | Gap vs target |
|------|----------------|---------------|
| Landing → Sign in | `SignInModal` → always `pushState('/platform')` | No return URL; not “Book a Turf” / “Join a Tournament” |
| Landing → “Book” in header | `bookHref="/platform#book"` | User may not be registered; `#book` hidden until profile complete |
| Platform logged out | Only “Continue with Google” block | No browse-only turf/esports |
| Admin staff | Google sign-in + `admins/{uid}` in Firestore | Admin UI still inside user shell at `#admin-panel`; same sign-out as user |
| Sign out (landing header) | `signOut` + `/` | OK for marketing; platform uses separate sign-out inside monolith |

---

## 2. Landing page inventory (current `/`)

| Section | Component | Pitch / PRD alignment | Gaps |
|---------|-----------|----------------------|------|
| Hero | `Hero.tsx` | Tagline direction OK (“Where gaming meets sports”) | **Single CTA** “Learn more” → `#early-access`; missing **Book a Turf** + **Join a Tournament** |
| Four pillars | `LandingInfoSection.tsx` | Matches deck pillars (turf, esports, wellness, AI) | Good content block; not wired to `/turf` / `/esports` |
| Clients / partners | `ClientsSection.tsx` | Brand activations (deck) | Placeholder symbols only — fine for now |
| Narrative | `StickyModelNarrativeSection.tsx` | “One hub” story (deck) | 3D GLB steps; not the PRD product flows |
| Contact / waitlist | `EarlyAccessSection.tsx` | Deck contact + email | Waitlist ≠ full registration; phone present |
| Brand banner | `BrandShowcaseSection.tsx` | — | Decorative |
| Footer | `Footer.tsx` | Tagline | **No** Turf / Esports / Leaderboard / About / socials |

**Not on landing (but built elsewhere, unused)**

- `PillarsSection.tsx` — duplicate “two engines” story vs `LandingInfoSection`
- `TurfSection.tsx`, `EsportsSection.tsx`, `RegisterSection.tsx`, `AiGamesSection.tsx` — marketing copy + demos; **never imported in `App.tsx`**
- `ProfileTeamTeaser.tsx`, `ModelShowcaseSection.tsx`, `HeroRotatingShowcase.tsx` — orphans

**Planned (your note + pitch deck slide 7) — not implemented**

- **Founders section:** Priyanka Mondal (CDO), Sayantan Hait (CGO), Chaitradip Sarkar (COO), Puspul Bag (CEO) — add as `FoundersSection` on landing after approval; do not fold into platform.

---

## 3. User app inventory (current `/platform`)

All logic lives in **`ChampionCircuitPlatform.tsx`** with state from:

- `useLocalState` → `localStorage` keys (`cc_profile`, `cc_turfs`, `cc_tournaments`, …)
- Firestore `platformState/{uid}` — **merges entire blob per user** (profile, turfs, tournaments, teams, admin draft fields)

### 3.1 Implemented (prototype level)

| Feature | PRD expectation | Current behavior | Risk |
|---------|-----------------|------------------|------|
| Registration fields | Name, email, phone, city, age, IGN, avatar | Form after Google; no email/password | PRD auth model not met; flag for backend phase |
| Turf by city | Filter by registered city | `cityTurfs` filter works on seed data | Turf list is **per-user in Firestore**, not shared catalog |
| Slot grid | Booked = greyed, disabled | `.slot-cell.is-booked` + `disabled` | OK visually; **no payment**, message only |
| Esports tabs | Live / Upcoming / Completed / **Exclusive** | Only 3 tabs; `isExclusive` is a label on cards | **Exclusive tab missing** |
| Tournament register | Gated on profile | Inline button on live only | No `/esports/tournament/[id]` |
| Leaderboard | Cross-tournament points | Computed in `useMemo` from local tournaments | Embedded under esports; no `/leaderboard` |
| Teams | Create, invite ≤7 emails | Basic create + list | No edit/delete/leader rules; no email send |
| Payment | Razorpay etc. | “Redirected to payment flow” string | Stub only — **preserve contract, implement later** |

### 3.2 Not implemented (PRD v1)

- Turf detail route + confirmation page
- Paid tournament payment redirect
- Bracket UI / result entry (knockout, double-elim, group, group+knockout)
- Admin: slot CRUD, turf CRUD, manual leaderboard edits, user/team admin, SEO fields
- Real-time slot sync across users (data is local/per-user today)
- Password reset, session docs as specified

---

## 4. Admin inventory (current — **embedded, not separate**)

| Item | Location | Problem |
|------|----------|---------|
| Admin gate | `isFirestoreAdmin(user)` → `admins/{uid}` | Correct **role** idea |
| Admin UI | `#admin-panel` inside `ChampionCircuitPlatform` | Same layout as user; **must move to `/admin/*` + `AdminLayout`** |
| Admin auth | Same `signInWithPopup(Google)` as users | **Violates** “separate admin login”; admin ≠ user session conceptually |
| Admin capabilities | Edit home description/background; change tournament status buttons | No turfs/slots, brackets, leaderboard edits, users, content CMS |
| Admin data | `admin` object inside user `platformState` | Admin config should not live in end-user state doc |

**#1 bleed:** Any Firebase user with `admins/{uid}` sees admin tools **below** profile and booking on the same scroll page, with the **marketing Header** (Overview / Book / Contact).

---

## 5. Navigation audit

### 5.1 `Header.tsx` (only navbar)

| Link | Landing | Platform |
|------|---------|----------|
| Logo → `#top` | ✓ | ✓ (`overviewHref="/"`) |
| Overview | `#top` or `/` | `/` |
| Book | `/platform#book` | `#book` |
| Contact | `#early-access` | `/#early-access` |
| Right CTA | Sign in / Sign out | Sign in / Sign out |

**Missing vs your spec:** Turf, Esports, Leaderboard, About, Login/Register (public) vs Avatar menu (app).

### 5.2 Duplicate / competing auth entry points

1. `SignInModal` on landing (Google → `/platform`)
2. `ChampionCircuitPlatform` Google card when `!authUser`
3. Admin uses the same Google session

### 5.3 Duplicate UI primitives (no design-system folder)

| Pattern | Implementations |
|---------|-----------------|
| Buttons | `.btn`, `.btn-primary`, `.btn-ghost` in CSS only — no `Button.tsx` |
| Cards | `.card` class — no `Card.tsx` |
| Nav | `Header.tsx` only — no `Navbar.tsx` / `Sidebar.tsx` |
| Footer | `Footer.tsx` — minimal |
| Page width | `.section-inner`, `.section` — informal `PageContainer` |

**Token drift**

- `index.css`: `--gold` is **white**; accent is monochrome, not **electric blue** per brand brief.
- `index.html` loads **Montserrat**; `index.css` uses **Newsreader + DM Sans** — two font stacks.
- OG/title still “Where **Game** Meets Sports” while hero says “**gaming**”.

---

## 6. Data & backend contracts (preserve in Step 2)

| Integration | Contract | Notes for refactor |
|-------------|----------|-------------------|
| Firebase Auth | Google popup | Keep; add email/password later per PRD |
| Firestore `waitlist` | `addDoc` email + timestamp | Landing only — OK |
| Firestore `admins/{uid}` | `{ role, enabled }` | Keep gate; use on `/admin` only |
| Firestore `platformState/{uid}` | User blob | **Split conceptually**: user profile/bookings vs shared turfs/tournaments (today wrongly per-user) — flag, don’t silently break |
| Seed data | `platformSeed.ts` | Shared catalog source until real APIs |
| localStorage | `cc_*` keys | Migrate carefully or hydrate once |

**Broken / risky (flagged, not fixed in Step 1)**

- Turf/tournament lists saved per user → two users won’t see the same bookings.
- Admin content stored in user `platformState`.
- No payment gateway wiring.

---

## 7. Orphan & overlap map

```
App.tsx (/)
├── Hero, LandingInfoSection, ClientsSection
├── StickyModelNarrativeSection, EarlyAccessSection, BrandShowcaseSection
├── Header, Footer, SignInModal

App.tsx (/platform)
└── ChampionCircuitPlatform  ← user + admin + everything

UNUSED (safe to wire into landing or delete later):
├── PillarsSection          ← overlaps LandingInfoSection
├── TurfSection + TurfSlotDemo
├── EsportsSection
├── RegisterSection
├── AiGamesSection
├── ProfileTeamTeaser
├── ModelShowcaseSection, HeroRotatingShowcase
```

---

## 8. Alignment: Pitch deck vs PRD vs site

| Theme | Pitch deck | PRD v1 | Current site |
|-------|------------|--------|--------------|
| Positioning | India’s first integrated youth sports & gaming ecosystem | Dual-section web app (Turf + Esports) | Landing copy closer to deck; product is PRD-shaped prototype |
| Tagline | Where Gaming Meets Sports | — | Hero/ footer “gaming”; meta tags still “Game” |
| Pillars | Turf, Esports, Wellness, AI, Brand activations | Turf booking + Esports hub features | Landing 4 cards; wellness/AI narrative only |
| Audience | Urban youth 16–28 | Registration fields | Mentioned on landing; platform form matches PRD fields (partial) |
| Proof | ₹8.5L revenue, IIM, IIT BHU, NESC, I-DAPT, BBA | — | `landing-trust-note` on landing |
| Founders | 4 co-founders with roles | — | **Not built** — planned landing section |
| Admin | — | Full CMS + brackets + leaderboard | Minimal inline panel only |

---

## 9. Proposed canonical route map (for your approval)

### A. Public / marketing — `PublicLayout`

| Route | Page | Notes |
|-------|------|--------|
| `/` | Landing | Hero + dual CTA, pillars, narrative, trust, **founders**, clients, contact |
| `/about` | About | Optional split from long landing |
| `/turf` | Turf browse (read-only) | City filter when logged out; CTA → auth |
| `/esports` | Tournament browse (read-only) | Tabs: Live / Upcoming / Completed / Exclusive |
| `/leaderboard` | Public leaderboard | Read-only aggregate |
| `/login` | Auth | Or modal with `?next=` |
| `/register` | Registration | PRD fields after auth |

**Public nav:** Logo · Turf · Esports · Leaderboard · About · **Login / Register**

### B. User app — `AppLayout` (requires registered user for gated actions)

| Route | Page | Reuse from |
|-------|------|------------|
| `/turf/[id]` | Venue + slot picker | Extract from `ChampionCircuitPlatform` turf block + `TurfSlotDemo` patterns |
| `/turf/[id]/book` | Payment + confirm | New shell; keep stub payment message until gateway |
| `/esports/tournament/[id]` | Detail + register | Extract tournament card logic |
| `/profile` | Profile + teams | Extract profile/teams section |
| `/bookings` | My bookings | New list (data TBD) |

**App nav:** Same left links + avatar menu: Profile · My Bookings · My Teams · Logout

**Auth redirect:** `next` query or path stack — never blind `/platform`.

### C. Admin — `AdminLayout` (separate chrome)

| Route | Purpose |
|-------|---------|
| `/admin/login` | Admin-only sign-in (same Firebase + `admins/{uid}` OK initially; separate **session intent** and UI) |
| `/admin` | Dashboard |
| `/admin/turfs` | Turfs & slots |
| `/admin/tournaments` | CRUD + status |
| `/admin/tournaments/[id]/bracket` | Result entry by format |
| `/admin/leaderboard` | Manual point edits |
| `/admin/users` | Users & teams |
| `/admin/content` | Landing copy CMS |

**Guard:** Non-admin → `/admin/login` (not `/` or `/profile`).

**Deprecate:** `/platform` as a grab-bag → redirect to `/turf` or `/profile` after migration.

---

## 10. Admin / user separation plan (Step 2 blueprint)

### Principles

1. **Three shells, zero shared navbar** across the admin boundary.
2. **One auth provider (Firebase)** can remain, but **two products**: consumer session vs admin session (e.g. `sessionStorage` scope, or separate `AdminAuthProvider` that only mounts under `/admin`).
3. **Shared catalog data** (turfs, tournaments, leaderboard) moves to Firestore collections **`turfs`**, **`tournaments`**, **`leaderboard`** (names TBD) — not `platformState/{uid}`.
4. **User doc** holds profile, bookings refs, team memberships only.

### Extraction order (incremental)

1. Add `react-router-dom` + three layouts (empty shells).
2. Move landing sections into `/` route unchanged.
3. Split `ChampionCircuitPlatform` into `pages/turf/*`, `pages/esports/*`, `pages/profile/*` — **move JSX, keep hooks/state initially**.
4. Carve admin JSX into `pages/admin/*` + sidebar; delete `#admin-panel` from user tree.
5. Introduce `components/ui/{Button,Card,Navbar,Sidebar,Footer,PageContainer}.tsx` — wrap existing classes first.
6. Add `FoundersSection` on landing (deck content).
7. Wire public browse routes with auth modal + `next` redirect.

### Design system (Step 3 preview — after routes approved)

- Extend `:root` with `--accent` electric blue; keep one token file (`index.css`).
- Condensed display face for headings (align `index.html` + CSS to one stack).
- Status colors: live / upcoming / completed / exclusive.
- Shared `EmptyState`, `LoadingState`, `ErrorState` components.

---

## 11. End-to-end journeys — current vs target

| Journey | Current | Target (after Steps 2–3) |
|---------|---------|---------------------------|
| Logged-out → book turf | `/platform` → register → scroll turf | `/` → `/turf` → login `?next=/turf/id` → book → confirm |
| Logged-out → tournament | Same monolith | `/esports` → `/esports/tournament/id` → register |
| Admin → results → leaderboard | Status buttons only; points from winner fields | `/admin/tournaments/[id]/bracket` → shared leaderboard doc |

---

## 12. Recommended decisions (need your OK)

1. **Approve route map** in §9 as canonical (or mark changes).
2. **Confirm** `react-router-dom` for Step 2 (standard for Vite SPA).
3. **Founders on landing** — full four cards with titles from deck; photos optional placeholders?
4. **Keep `/platform` redirect** for bookmarks during migration?
5. **Auth v1:** Google-only until email/password backend is ready (PRD gap documented)?

---

## 13. What Step 1 intentionally did *not* do

- No new layouts, no router install, no moving admin, no design-system rewrites.
- No changes to Firestore shapes (only documented risks).

---

**Implementation status (2026-05-27):** Steps 2–3 implemented — `react-router-dom`, three layouts, routed pages, `AuthContext` + `PlatformContext`, admin shell at `/admin/*`, shared UI primitives, founders section, dual hero CTAs. `/platform` redirects to `/turf`. Payment gateway and shared Firestore catalog remain stubbed/flagged.
