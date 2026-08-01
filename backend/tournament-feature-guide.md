# Champion Circuit — Tournament Feature Guide

*How the tournament system works and how to use it. Covers everything on the `Feature_Tournament` branch.*

---

## 1. What this feature is

A complete **knockout (single-elimination) tournament system** for Champion Circuit — for both turf sports and esports events held at partner venues. Players browse and register for free tournaments, staff run them on match day, and results feed the city/sport leaderboards.

**At launch:**
- **Free entry only.** Every tournament is free. The UI shows a green **FREE** badge, built so a ₹ price can be switched on later with no redesign. (Paid entry is deliberately blocked for now — see §9.)
- **Knockout format only.** Round-robin / group / double-elimination are not built yet.
- **All events are venue-based** (a turf or a partner game zone).

---

## 2. Where to find it

| Page | URL | Who |
|---|---|---|
| Browse tournaments | `/tournaments` | Everyone |
| Tournament detail + register | `/tournaments/<slug>` | Everyone |
| My registrations & fixtures | `/my-matches` → **Tournaments** tab | Logged-in players |
| Super Admin portal | `/staff/admin` → **Tournaments** | Super admins |
| Venue Owner portal | `/staff/venue` → **Tournaments** | Venue owners |
| Match Admin portal | `/staff/match` | Assigned match admins |

There's a new **Tournaments** item in the top navigation bar. Old `/esports/tournament/<id>` links still work — they automatically redirect to the new page.

---

## 3. The four roles

| Role | What they can do |
|---|---|
| **Player** (any logged-in user) | Browse, register (free), withdraw, join a waitlist, check in via QR, view brackets and results |
| **Super Admin** (`is_admin`) | Create/publish any tournament, generate brackets, approve venue-owner tournaments, assign match admins, cancel events, download data |
| **Venue Owner** (`is_venue_owner`) | Create tournaments **at their own venue** (needs super-admin approval), run their own tournaments' match day |
| **Match Admin** (assigned per tournament) | Check players in, record & verify match results, resolve no-shows on match day |

---

## 4. Player workflow

### Registering
1. Go to **Tournaments** in the nav, or open a tournament from the Esports/Turf pages.
2. Filter by **status** (Upcoming / Live / Completed), **type** (Sports / Esports), and **city** (top bar).
3. Open a tournament → you'll see the banner, prize pool, dates, stages with maps, rules, and the current participant list.
4. Click **Register — FREE**.
   - **Solo tournaments:** confirm your name and phone number (pre-filled from your profile). Phone is required — organizers use it on match day.
   - **Squad tournaments (duo/squad/team):** you must be the **captain** of a team (create one from your profile first). Pick your team, then enter each member's name and phone.
5. You're confirmed instantly. The button changes to **Registered ✓**.

### Managing your registration
- **Your check-in QR:** on the tournament page (or **My Matches → Tournaments**), tap **Show check-in QR**. Show this at the venue desk on match day.
- **Withdraw:** allowed until the registration deadline. Your spot is freed and offered to the waitlist automatically.
- **Waitlist:** if a tournament is full, you can **join the waitlist**. If someone withdraws before the deadline, the oldest waitlisted entry is promoted automatically (you get a notification + email).

### Following the action
- Once a tournament goes **Live**, the **Bracket** appears on its page and updates automatically (every 30 seconds). Your own matches are highlighted.
- **My Matches → Tournaments** shows each registration with your **next fixture** (round, opponent, time, venue).
- When it's over, the **Final standings** (podium) appear, and your placement points hit the leaderboard.

---

## 5. Super Admin workflow

Go to **`/staff/admin` → Tournaments**.

### Creating a tournament (3-step wizard)
Click **+ Create tournament**:

1. **Details** — name, game/sport, mode (solo/duo/squad/team), max & min participants, registration deadline, start/end times, prize pool, banner, description, rules.
   - **Awards leaderboard points** toggle — when on, finishers earn points (Winner 100 · Runner-up 60 · Semi-finalist 35 · Quarter-finalist 20) that move the city/sport leaderboards. Turn off for casual events.
   - **Featured** toggle — pins the tournament to the top of the browse page.
2. **Stages** — optional. Add one stage per location/time window. A single-venue event needs none (it uses the primary venue). Multi-venue example: "Qualifiers" at Game Zone A, "Grand Final" at Game Zone B. Add station-count notes here so match admins can schedule waves.
3. **Review** — **Save as draft** or **Publish & open registration**.

### Running it
Each tournament card has action buttons depending on its state:
- **Open / Close registration** — manual control while in the registration phase.
- **Generate bracket** — closes registration, seeds the bracket (top seeds get byes if the count isn't a power of two), sets the tournament **Live**, blocks the venue's booking slots for stage windows, and notifies every participant. **This is one-shot — it can't be re-run.**
- **Approve / Reject** — appears for venue-owner tournaments awaiting approval (Reject sends it back to draft with a reason).
- **Block venue slots** — re-run slot blocking manually; warns you about any existing bookings that overlap.
- **Registrations CSV** — download the full participant list (name, username, email, phone, team, roster, payment, check-in, seed, registered-at) — opens in Excel.
- **Assign match admin** — hand match-day control to someone by username.
- **Cancel event** — cancels the tournament and notifies every registrant with a reason.

### Seeding
By default entrants are shuffled. Seed numbers can be set later for manual seeding (top seeds meet only in the final).

---

## 6. Venue Owner workflow

Go to **`/staff/venue` → Tournaments**.

1. **+ Create tournament** — same wizard, but the venue is fixed to yours and the event saves as a **draft**.
2. **Submit for approval** — the platform admin is notified. You can edit freely *until* you submit; after that the content is frozen until an admin approves or rejects it.
3. Once approved, it opens for registration publicly.
4. You have full match-day access to your own tournaments (participants, check-in, CSV, results) via the **Match Admin** portal — click **Manage matches**.

---

## 7. Match Admin workflow (match day)

Go to **`/staff/match`**. You'll see only the tournaments you're assigned to (or, for venue owners, at your venue).

### Check-in
- **Participants** tab shows everyone with phone, team, and check-in status.
- Scan a player's QR code or type their **check-in code** into the box, or hit **Check in** on their row.
- **🔔 Remind check-in** sends a nudge to everyone not yet checked in.
- **⬇ CSV** downloads the registration sheet.

### Running matches
- **Matches** tab lists bracket matches by round (Quarter Final / Semi Final / Final) with each side's players.
- **Schedule** — set a per-match time (for running matches in waves when stations are limited).
- **Edit scores** — enter each side's result (win/loss) and score.
- **Verify & award points** — confirms the result. The winner **automatically advances** into the next match, and both players in the newly-formed next match get a "your fixture is set" notification. Verifying the **final** completes the tournament, writes the podium, and awards placement points.
- **Walkover → A / → B** — for no-shows. The chosen side wins and advances through the normal flow. (You can only record a walkover once both sides are decided.)

### Recording side matches
The **Record match** tab is for friendlies / non-bracket matches. Bracket matches are created automatically by *Generate bracket* — you don't record those manually.

---

## 8. Retention & notifications

Players get in-app notifications (and email for the big three) at every step:

| Event | Notification | Email |
|---|---|---|
| Registration confirmed | ✅ | ✅ |
| Promoted off the waitlist | ✅ | ✅ |
| Bracket published | ✅ | ✅ |
| Your next fixture is set | ✅ | ✅ |
| Match result | ✅ | — |
| Final placement | ✅ | — |
| Check-in reminder | ✅ | — |
| Tournament cancelled | ✅ | — |

**Leaderboard tie-in:** when the points toggle is on, finishers earn Winner 100 / Runner-up 60 / SF 35 / QF 20, which visibly move the city and sport leaderboards — the main draw for free events.

---

## 9. What's intentionally NOT included yet

These are designed-for but deferred, so you know the boundaries:

- **Paid entry.** All tournaments are free; the create form rejects a non-zero entry fee. The database columns and UI badge are ready for when the Razorpay flow is wired up.
- **Round-robin / group / double-elimination formats.** Knockout only.
- **PUBG-style battle-royale standings** (points across lobbies, not a bracket).
- **Fully-online esports** (schema supports it; no UI — all events are at venues).
- **Automatic reminders/cancellation on a timer.** There's no background scheduler — deadline enforcement and under-subscription auto-cancel happen when someone next opens the tournament, and check-in reminders are sent manually by the match admin.

---

## 10. Operational notes

- **Byes:** if the participant count isn't a power of two (e.g. 5, 6, 7 players), the top seeds get automatic byes into round 2. Byes award no points and don't count as matches played.
- **Slot blocking:** generating a bracket blocks the venue's bookable slots during stage windows so regular bookings can't double-book the turf/stations. Existing overlapping bookings are flagged for you to resolve manually; unblocking is manual (delete the blocked slots).
- **Minimum participants:** if set and not met by the deadline, the tournament auto-cancels and everyone is notified.
- **Withdrawals** are only allowed while registration is open and before the deadline. After the bracket is generated, a dropout is handled by the match admin as a walkover.

---

*Feature branch: `Feature_Tournament`. Built July 2026.*
