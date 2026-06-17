# Requirements Document

## Introduction

This feature improves two existing pages in the Champion Circuit React frontend: **TurfBrowsePage** and **VenueDetailPage**. The goal is to make venue discovery more contextual and relevant (auto-defaulting city to the logged-in user's profile, compact city selector, functional sport filtering, sport-aware venue cards) and to make the venue detail page richer (sport-sorted listings, Google Maps embed, inquiry channel, reviews section, listing category filter bar). A companion backend reviews API must be added to support the reviews section.

Both pages share the same dark navy/teal theme, use custom CSS with BEM-like class names, and interact with `ccApi` / `api` clients in `src/lib/`.

---

## Glossary

- **TurfBrowsePage**: The page at `/turf` that lists all venues with city and sport filters.
- **VenueDetailPage**: The page at `/venue/:id` that shows full venue information and its listings.
- **CityContext**: React context in `src/context/CityContext.tsx` managing selected city filter state, persisted to `localStorage`. Provides `cities`, `toggleCity`, `clearCities`, `isSelected`, `matchesCity`.
- **CC_CITIES**: The fixed list of supported cities: `['Kolkata', 'Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Pune', 'Ahmedabad']`.
- **AuthContext**: React context in `src/context/AuthContext.tsx` providing `user` (of type `UserRead`), `loading`, `setToken`, `signOut`.
- **UserRead**: TypeScript interface in `src/lib/api.ts` representing a logged-in user. Contains `city: string`.
- **CityBar**: Existing component in `src/components/ui/CityBar.tsx` that renders a row of city chip buttons tied to `CityContext`.
- **CityDropdown**: New compact single-select dropdown component to replace `CityBar` on the TurfBrowsePage.
- **Sport Filter**: A horizontal row of category chips on TurfBrowsePage allowing the user to filter venues by a category slug (e.g. `cricket`, `badminton`).
- **Category**: A listing category object `{ id, slug, name, type, icon_url }` from `/api/categories`. Types: `physical`, `esports`, `food`, `merchandise`, `service`.
- **Venue**: A business offering one or more listings. Has `id`, `name`, `city`, `lat`, `lng`, `is_verified`, `cover_url`, `listings?: VenueListing[]`.
- **VenueListing**: A single bookable activity within a venue, with `id`, `category: Category`, `title`, `photos`, `price_per_hour`, `price_per_session`, `is_bookable`, `is_active`.
- **ListingFilterBar**: A new chip bar on VenueDetailPage that filters the displayed listings by category slug.
- **InquiryModal**: A new modal component on VenueDetailPage with a form to send an inquiry to the venue (name, contact, message).
- **ReviewsSection**: A new section on VenueDetailPage that displays existing reviews and a submission form for logged-in users.
- **Review**: Backend model (`reviews` table) with `id`, `listing_id`, `user_id`, `booking_id`, `rating` (1–5), `comment`, `is_verified_visit`, `created_at`.
- **Reviews API**: New backend routes under `/api/reviews` to be added to the FastAPI backend.
- **Sport Query Param**: The `?sport=<slug>` query parameter passed in the URL when navigating from TurfBrowsePage to VenueDetailPage after selecting a sport filter.

---

## Requirements

### Requirement 1: City Filter Auto-Default to User Profile City

**User Story:** As a logged-in user, I want the city filter to automatically default to my profile city when I visit the Turf Browse page, so that I see relevant venues for my city without having to manually select it.

#### Acceptance Criteria

1. WHEN the TurfBrowsePage mounts AND `user.city` is set AND `user.city` (case-insensitive match) is contained in `CC_CITIES`, THE TurfBrowsePage SHALL set the `CityContext` selected city to `user.city` if no city is currently selected in `CityContext` (i.e., `cities.length === 0`).
2. WHEN the TurfBrowsePage mounts AND `user` is `null` (not logged in), THE TurfBrowsePage SHALL leave the `CityContext` state unchanged (defaulting to "All").
3. WHEN the TurfBrowsePage mounts AND `user.city` is set BUT does not match any entry in `CC_CITIES` (case-insensitive), THE TurfBrowsePage SHALL leave the `CityContext` state unchanged (defaulting to "All").
4. WHEN the user has already selected a city in a previous or current session (i.e., `cities.length > 0` as loaded from `localStorage` or set manually), THE TurfBrowsePage SHALL NOT override the existing `CityContext` selection with the profile city.
5. THE `CityContext` SHALL persist the auto-defaulted city to `localStorage` using the same storage key `cc_selected_cities`, consistent with existing persist behaviour.

---

### Requirement 2: Compact City Filter Dropdown

**User Story:** As a user browsing venues, I want the city filter to be compact, so that it doesn't take up excessive vertical space on the page.

#### Acceptance Criteria

1. THE TurfBrowsePage SHALL replace the full-width `CityBar` chip row with a `CityDropdown` component that renders as a single inline dropdown selector.
2. THE `CityDropdown` SHALL display the currently selected city name (or "All Cities" when no city is selected) as its label.
3. WHEN the user opens the `CityDropdown` and selects a specific city name, THE `CityDropdown` SHALL call `clearCities` first and then `toggleCity(city)` so that only the selected city is active, and SHALL update the display label.
4. WHEN the user selects "All Cities" in the `CityDropdown`, THE `CityDropdown` SHALL call `clearCities` (and SHALL NOT call `toggleCity`).
5. THE `CityDropdown` SHALL be keyboard-accessible: it SHALL respond to `Enter` and `Escape` keys to open/close the options list and `ArrowUp`/`ArrowDown` to navigate options.
6. THE `CityDropdown` SHALL render all `CC_CITIES` options plus an "All Cities" option at the top.
7. WHERE the `CityBar` component is used on other pages (e.g. EsportsBrowsePage, VouchersPage), THE `CityBar` component SHALL remain unchanged — only TurfBrowsePage switches to `CityDropdown`.

---

### Requirement 3: Functional Sport Filter on TurfBrowsePage

**User Story:** As a user looking for a specific sport, I want the sport filter chips to actually filter the venue list, so that I only see venues that offer that sport.

#### Acceptance Criteria

1. WHEN a sport chip is explicitly selected on TurfBrowsePage AND the `venues` data has been loaded, THE TurfBrowsePage SHALL display only venues whose `listings` array contains at least one entry where `listing.category.slug === selectedSport` AND `listing.is_active === true`.
2. WHEN the "All sports" chip is selected (no explicit sport chip chosen), THE TurfBrowsePage SHALL display all venues that pass the city filter, regardless of their listings. Sport-based filtering rules SHALL only apply when a sport chip is explicitly selected.
3. WHEN the venue data returned by `ccApi.venues()` does not include nested `listings`, THE TurfBrowsePage SHALL fetch listings for each venue via `ccApi.venueListings(venue.id)` to enable client-side sport filtering.
4. IF the sport-filtered result is an empty list, THE TurfBrowsePage SHALL display the existing empty state UI ("No venues yet") with a message indicating no venues were found for the selected sport.
5. THE sport filter chips SHALL only display categories of type `physical` or `esports`, consistent with the existing behaviour.
6. WHEN a sport filter is active, THE TurfBrowsePage SHALL append `?sport=<slug>` to the venue detail navigation URL so VenueDetailPage can receive the context.

---

### Requirement 4: Sport-Aware Venue Card Preview

**User Story:** As a user who has filtered by a sport, I want the venue card to show a preview of the relevant listing, so that I know what's available before clicking through.

#### Acceptance Criteria

1. WHEN `selectedSport` is not `'all'` AND the venue has at least one matching active listing, THE VenueCard SHALL display the title of the first matching listing as a subtitle beneath the venue name (e.g. "Cricket Turf A").
2. WHEN `selectedSport` is not `'all'` AND the venue has multiple matching active listings, THE VenueCard SHALL display the title of the first matching listing AND a count indicator showing the number of additional matching listings (e.g. "Cricket Turf A + 2 more"). Both the title and the count indicator SHALL always be shown together when multiple listings match.
3. WHEN `selectedSport` is `'all'`, THE VenueCard SHALL NOT display any listing subtitle — only the venue name and description.
4. THE listing subtitle SHALL be styled distinctly (e.g. teal accent color, smaller font) so it is visually differentiated from the venue name.

---

### Requirement 5: Sport-Prioritised Listings on VenueDetailPage

**User Story:** As a user who navigated from a sport filter, I want the matching listings to appear first on the venue detail page, so that I can quickly find and book the sport I'm looking for.

#### Acceptance Criteria

1. WHEN the VenueDetailPage URL contains `?sport=<slug>` AND listings have loaded, THE VenueDetailPage SHALL sort listings so that listings matching `sport` (by `listing.category.slug`) appear before non-matching listings.
2. WHEN the VenueDetailPage URL contains `?sport=<slug>`, THE VenueDetailPage SHALL initialise the `ListingFilterBar` active chip to the sport value from the URL parameter. The chip SHALL be set to the sport slug value even if the slug does not match any listing category present — it will simply filter to zero results in that case.
3. WHEN `?sport=<slug>` is absent from the URL, THE VenueDetailPage SHALL display listings in their default order and initialise the `ListingFilterBar` to "All".
4. THE sort SHALL be stable: within the matching group and within the non-matching group, original server order SHALL be preserved.

---

### Requirement 6: Listing Category Filter Bar on VenueDetailPage

**User Story:** As a user viewing a venue, I want to filter listings by category, so that I can quickly find the type of activity I want without scrolling through all listings.

#### Acceptance Criteria

1. THE VenueDetailPage SHALL display a `ListingFilterBar` above the listings grid, containing an "All" chip and one chip per distinct category present in the venue's active listings.
2. WHEN the user clicks a category chip in the `ListingFilterBar`, THE VenueDetailPage SHALL display only listings whose `listing.category.slug` matches the selected chip.
3. WHEN the user clicks "All" in the `ListingFilterBar`, THE VenueDetailPage SHALL display all active listings.
4. IF the venue has only one distinct category, THE `ListingFilterBar` SHALL still render but the single category chip SHALL be shown alongside "All" for consistency.
5. THE `ListingFilterBar` chips SHALL display the category name and emoji icon (using the same `SPORT_ICONS` mapping as TurfBrowsePage) for visual consistency.
6. THE `ListingFilterBar` SHALL be horizontally scrollable on mobile viewports to prevent overflow.

---

### Requirement 7: Google Maps Section on VenueDetailPage

**User Story:** As a user viewing a venue, I want to see the venue's location on a map, so that I can assess how easy it is to get there.

#### Acceptance Criteria

1. WHEN `venue.lat` and `venue.lng` are both non-empty strings, THE VenueDetailPage SHALL render a Google Maps section containing an `<iframe>` embed pointing to `https://www.google.com/maps?q={lat},{lng}&output=embed`. Coordinates SHALL take precedence over address-based search when both are available.
2. WHEN `venue.lat` or `venue.lng` is empty or absent BUT any of `venue.address_line1`, `venue.city`, or `venue.name` is non-empty, THE VenueDetailPage SHALL render a Google Maps section with an `<iframe>` pointing to `https://www.google.com/maps/search/?api=1&query={encodeURIComponent(venue.name + ' ' + venue.city)}&output=embed`.
3. THE VenueDetailPage SHALL render the Google Maps section whenever any location data is available (coordinates or partial address). THE VenueDetailPage SHALL NOT render the Google Maps section only when all of `lat`, `lng`, `address_line1`, `city`, and `name` are empty or unavailable.
4. THE Google Maps `<iframe>` SHALL have `title="Venue location map"` for accessibility, `loading="lazy"`, `referrerPolicy="no-referrer-when-downgrade"`, and a fixed aspect-ratio container (16:9 ratio, full section width).
5. THE Google Maps section SHALL include a "Open in Google Maps" anchor link that opens the same coordinates or search query in a new tab.

---

### Requirement 8: Send Inquiry Feature on VenueDetailPage

**User Story:** As a user interested in a venue, I want to send an inquiry message to the venue, so that I can ask questions before booking.

#### Acceptance Criteria

1. THE VenueDetailPage SHALL display a "Send Inquiry" button in the venue header section.
2. WHEN the user clicks "Send Inquiry", THE VenueDetailPage SHALL open the `InquiryModal`.
3. THE `InquiryModal` SHALL contain a form with the following fields: Name (text, required), Contact (text — phone or email, required), Message (textarea, required, max 500 characters).
4. WHEN the user is logged in, THE `InquiryModal` SHALL pre-fill the Name field with `user.name` and the Contact field with `user.phone` if available, else `user.email`.
5. WHEN the user submits the `InquiryModal` form AND `venue.phone` is set, THE `InquiryModal` SHALL open a WhatsApp link (`https://wa.me/{sanitised_phone}?text={encodedMessage}`) in a new tab, where the message contains the user's name, contact, and message text.
6. WHEN the user submits the `InquiryModal` form AND `venue.phone` is NOT set BUT `venue.email` is set, THE `InquiryModal` SHALL open a `mailto:` link with the venue email, a subject of "Inquiry from {name}", and the message body pre-filled.
7. IF BOTH `venue.phone` and `venue.email` are empty, THE `InquiryModal` SHALL display an informational message: "This venue has not provided contact details. Please call the venue directly."
8. THE `InquiryModal` SHALL be closable via an "×" button and by pressing `Escape`.
9. THE `InquiryModal` form SHALL validate that Name and Contact are non-empty and Message is non-empty before submission; invalid fields SHALL display an inline error message.

---

### Requirement 9: Reviews Section — Display on VenueDetailPage

**User Story:** As a user considering a venue, I want to see reviews from other users, so that I can make a more informed decision.

#### Acceptance Criteria

1. THE VenueDetailPage SHALL include a Reviews section below the listings grid.
2. WHEN the Reviews API returns one or more reviews for the venue, THE VenueDetailPage SHALL render each review as a card showing: star rating (1–5 filled/empty stars), reviewer username, review comment, and `created_at` date formatted as "MMM YYYY" (e.g. "Jun 2026").
3. WHEN the Reviews API returns zero reviews, THE VenueDetailPage SHALL display a "No reviews yet — be the first!" message.
4. THE Reviews section SHALL show the venue's average rating (mean of all review ratings, rounded to 1 decimal place) alongside the total review count in the section header (e.g. "★ 4.3 · 12 reviews"). WHEN there are zero reviews, THE section header SHALL display "★ 0.0 · 0 reviews".
5. IF the Reviews API call fails, THE VenueDetailPage SHALL display a non-blocking error message ("Could not load reviews") without affecting the rest of the page.
6. THE VenueDetailPage SHALL load reviews by calling `ccApi.venueReviews(venueId)` which maps to `GET /api/reviews?venue_id={id}`.

---

### Requirement 10: Reviews Section — Submission on VenueDetailPage

**User Story:** As a logged-in user who has visited a venue, I want to submit a star rating and comment, so that I can share my experience with others.

#### Acceptance Criteria

1. WHEN the user is logged in, THE ReviewsSection SHALL display a review submission form below the existing reviews list.
2. WHEN the user is NOT logged in, THE ReviewsSection SHALL display a prompt ("Sign in to leave a review") with a link to `/login`.
3. THE review submission form SHALL contain: a star rating picker (1–5 stars, click to set), and a comment textarea (optional, max 500 characters).
4. WHEN the user submits the form AND `rating >= 1` AND the user is logged in AND the review form is displayed, THE ReviewsSection SHALL call `ccApi.submitReview({ venue_id, rating, comment })` which maps to `POST /api/reviews`. THE ReviewsSection SHALL NOT call the API when the user is not logged in or when the form is not displayed.
5. WHEN the review submission succeeds, THE ReviewsSection SHALL append the new review to the displayed list, update the average rating display, and reset the submission form.
6. IF the review submission fails with HTTP 409 (duplicate review by same user for the same venue), THE ReviewsSection SHALL display an inline error: "You have already reviewed this venue."
7. IF the review submission fails for any other reason, THE ReviewsSection SHALL display a generic inline error: "Could not submit review. Please try again."
8. THE star rating picker SHALL be keyboard-accessible: arrow keys SHALL move focus between stars, `Enter`/`Space` SHALL select the focused star.

---

### Requirement 11: Backend Reviews API

**User Story:** As a developer, I want a backend `/api/reviews` endpoint, so that the frontend can load and submit venue reviews.

#### Acceptance Criteria

1. THE Reviews_API SHALL expose `GET /api/reviews?venue_id={id}` returning a list of `ReviewRead` objects for the given venue (across all listings of that venue), ordered by `created_at` descending.
2. THE Reviews_API SHALL expose `POST /api/reviews` (authentication required) accepting `{ venue_id: int, rating: int, comment: str }` and creating a review record. Authentication SHALL be checked before any duplicate detection — unauthenticated requests SHALL receive HTTP 401. The `listing_id` field in the `reviews` table SHALL be nullable for venue-level reviews (see Requirement 12).
3. WHEN `rating` is outside the range 1–5 (inclusive), THE Reviews_API SHALL return HTTP 422 with a validation error.
4. WHEN the same authenticated user attempts to submit a second review for the same `venue_id`, THE Reviews_API SHALL return HTTP 409 with detail `"You have already reviewed this venue."`.
5. THE `ReviewRead` schema SHALL include: `id`, `venue_id`, `listing_id`, `user_id`, `username`, `rating`, `comment`, `is_verified_visit`, `created_at`.
6. THE Reviews_API route SHALL be registered in `app/main.py` under the existing `/api` prefix.

---

### Requirement 12: Backend Reviews Database Migration

**User Story:** As a developer, I want the `reviews` table to support venue-level reviews, so that the Reviews API can store and query reviews without requiring a specific listing.

#### Acceptance Criteria

1. THE Migration_Script (`backend/app/db/migrations.py`) SHALL add a `venue_id` column (`INTEGER`, nullable, foreign key to `venues.id`) to the `reviews` table via an idempotent `ALTER TABLE` statement.
2. THE `Review` SQLAlchemy model in `backend/app/models/match.py` SHALL be updated to include the `venue_id` mapped column.
3. THE Migration_Script SHALL be idempotent: running it multiple times SHALL NOT raise an error if the `venue_id` column already exists. IF the database connection fails or permissions are insufficient before executing migration statements, THE Migration_Script SHALL allow those errors to propagate normally.
4. THE existing `listing_id` column on the `reviews` table SHALL remain nullable so that both venue-level and listing-level reviews are supported.

---

### Requirement 13: Frontend Reviews API Client

**User Story:** As a developer, I want typed API client methods for reviews, so that frontend components can call the backend reviews endpoints with full TypeScript safety.

#### Acceptance Criteria

1. THE `ccApi` object in `src/lib/ccApi.ts` SHALL expose `venueReviews(venueId: number): Promise<Review[]>` calling `GET /api/reviews?venue_id={venueId}`.
2. THE `ccApi` object SHALL expose `submitReview(payload: { venue_id: number; rating: number; comment: string }): Promise<Review>` calling `POST /api/reviews` with the JWT token in the `Authorization` header.
3. THE `Review` TypeScript interface SHALL be added to `src/lib/ccApi.ts` with fields: `id`, `venue_id`, `listing_id`, `user_id`, `username`, `rating`, `comment`, `is_verified_visit`, `created_at`.
4. IF the `submitReview` call returns HTTP 409, THE `ccApi` SHALL throw an `ApiError` with `status: 409` so calling components can distinguish duplicate errors.
