# Requirements Document

## Introduction

This feature improves the Turf section of Champion Circuit across two pages: the Turf Browse Page (`TurfBrowsePage.tsx`) and the Venue Detail Page (`VenueDetailPage.tsx`).

The improvements address three problems on the browse page — an oversized city filter, a broken sport filter that does not actually filter venues, and missing listing previews on venue cards — plus five enhancements to the venue detail page: sport-context navigation, Google Maps integration, a "Send Inquiry" form, a Reviews section, and sport filter chips on the listings grid. Both frontend changes and new backend endpoints are required.

---

## Glossary

- **TurfBrowsePage**: The React page at `/turf` that lists all venue cards with city and sport filters.
- **VenueDetailPage**: The React page at `/venue/:id` that shows full venue info, listings, and new features.
- **CitySelector**: The compact UI component replacing the full `CityBar` row on `TurfBrowsePage`. Displays a single active city with a change affordance.
- **CityContext**: The React context (`CityContext.tsx`) that manages the currently selected city/cities, persisted in `localStorage`.
- **AuthContext**: The React context (`AuthContext.tsx`) that exposes the authenticated `user` object including `user.city`.
- **Venue**: A sports/gaming venue entity with fields: `id`, `name`, `lat`, `lng`, `address_line1`, `city`, `state`, `phone`, `email`, `is_verified`, `listings?`.
- **VenueListing**: A bookable activity offered by a venue with fields: `id`, `category` (with `slug`, `type`, `name`), `title`, `description`, `price_per_hour`, `price_per_session`, `capacity`, `duration_minutes`, `amenities`, `photos`.
- **Category**: A listing category with fields: `id`, `slug`, `name`, `type` (physical | esports | food | merchandise | service).
- **SportFilter**: The row of sport-category chips (`All`, `Cricket`, `Badminton`, etc.) on `TurfBrowsePage` and `VenueDetailPage`.
- **InquiryForm**: A modal form with `name`, `email`, `message` fields that submits a venue inquiry.
- **Review**: A user-submitted rating (1–5 stars) and optional comment (up to 500 characters) attached to a `VenueListing`, stored in the `reviews` table.
- **ReviewsAPI**: The new backend endpoints for reading and submitting reviews.
- **InquiryAPI**: The new backend endpoint `POST /api/venues/:id/inquiry` for submitting contact inquiries.
- **VenueOwner**: A user with `is_venue_owner = true`.

---

## Requirements

### Requirement 1: Compact City Selector on TurfBrowsePage

**User Story:** As a user browsing venues, I want the city filter to automatically use my profile city and take up minimal space, so that the page feels focused on my location without a row of chips crowding the layout.

#### Acceptance Criteria

1. WHEN the `TurfBrowsePage` loads and the logged-in user has a non-empty `user.city` value, THE `TurfBrowsePage` SHALL initialize the active city filter to the user's `city` value from `AuthContext`, overriding any previously persisted `CityContext` state for first-time loading.
2. WHEN the `TurfBrowsePage` loads and no user is logged in, THE `TurfBrowsePage` SHALL initialize the active city filter to "All" (no city restriction).
3. WHEN the `TurfBrowsePage` loads and the logged-in user has an empty `city` field, THE `TurfBrowsePage` SHALL initialize the active city filter to "All".
4. THE `CitySelector` component SHALL display only the currently active city name (or "All") as a single teal chip, not the full `CityBar` row of 8 city chips.
5. THE `CitySelector` component SHALL include a "Change" affordance (link or secondary button) that opens an inline dropdown containing all available cities from `CC_CITIES` plus an "All" option.
6. WHEN a user selects a city from the `CitySelector` dropdown, THE `CitySelector` SHALL update the active city in `CityContext` and close the dropdown.
7. WHEN the active city changes in `CityContext`, THE `TurfBrowsePage` SHALL re-filter the displayed venue cards on every city context change, regardless of whether the set of visible venues would differ from the previous filter state.

---

### Requirement 2: Working Sport Filter on TurfBrowsePage

**User Story:** As a user who wants to find a Cricket turf, I want the sport filter chips to actually show only relevant venues, so that I don't have to scroll through unrelated venues.

#### Acceptance Criteria

1. WHEN the `TurfBrowsePage` loads, THE `TurfBrowsePage` SHALL fetch venue data that includes each venue's listings (with `category.slug`) so sport-based filtering is possible client-side.
2. WHEN the user selects a sport chip with slug `S`, THE `TurfBrowsePage` SHALL display only venues where at least one active listing has `category.slug === S`, applying the sport filter independently of the active city filter.
3. WHEN the user selects the "All sports" chip, THE `TurfBrowsePage` SHALL display all venues regardless of listing categories.
4. IF the API returns venues without embedded listings, THEN THE `TurfBrowsePage` SHALL request venue listings separately and merge them before applying the sport filter.
5. WHEN sport filter `S` is active and a venue has no listings matching `S`, THE `TurfBrowsePage` SHALL exclude that venue from the displayed list.
6. WHEN sport filter `S` is active and no venues have listings matching `S`, THE `TurfBrowsePage` SHALL display the "No venues yet" empty state message.

---

### Requirement 3: Listing Preview on Venue Cards when Sport Filter is Active

**User Story:** As a user browsing with a sport filter active, I want to see a quick preview of the matching listing on each venue card, so that I can compare prices without opening every venue.

#### Acceptance Criteria

1. WHEN the sport filter is set to "All sports", THE `VenueCard` component SHALL NOT display a listing preview section.
2. WHEN a sport filter with slug `S` is active and a venue has one or more listings matching `S`, THE `VenueCard` component SHALL display the title and price of the first matching listing inside the card body.
3. THE `VenueCard` component SHALL display the listing price as "₹[amount] / hr" when `price_per_hour > 0`, or "₹[amount] / session" when `price_per_session > 0`, or "Free" when both are zero.
4. WHEN a venue has multiple listings matching the active sport filter, THE `VenueCard` component SHALL display only the first matching listing as the preview (by listing `id` ascending order).

---

### Requirement 4: Sport Context Navigation on VenueDetailPage

**User Story:** As a user who navigated to a venue from a sport filter (e.g., `?sport=cricket`), I want the page to highlight matching listings immediately, so that I can see the relevant options without scrolling through all listings.

#### Acceptance Criteria

1. WHEN the `VenueDetailPage` URL contains a `sport` query parameter, THE `VenueDetailPage` SHALL read the sport slug from the URL and set the active sport tab to that slug on initial render.
2. WHEN the `VenueDetailPage` has an active sport tab with slug `S`, THE `VenueDetailPage` SHALL display a `SportFilter` chip row at the top of the listings section showing all sport categories present in the venue's listings.
3. WHEN the active sport tab `S` is set, THE `VenueDetailPage` SHALL display only listings whose `category.slug === S`.
4. WHEN the user clicks a different sport chip in the `SportFilter` row, THE `VenueDetailPage` SHALL update the active sport tab and re-filter the listings grid accordingly.
5. WHEN the user clicks the "All" chip in the `SportFilter` row, THE `VenueDetailPage` SHALL clear the sport filter and display all active listings.
6. WHEN the active sport tab changes, THE `VenueDetailPage` SHALL scroll the listings section into the viewport using `Element.scrollIntoView`.

---

### Requirement 5: Google Maps Integration on VenueDetailPage

**User Story:** As a user viewing a venue detail page, I want a clear way to get directions, so that I can navigate to the venue without manually copying the address.

#### Acceptance Criteria

1. WHEN a venue has both `lat` and `lng` fields set to non-empty strings, THE `VenueDetailPage` SHALL render a "Get Directions" button that opens `https://www.google.com/maps?q={lat},{lng}` in a new browser tab.
2. WHEN a venue has an empty `lat` or `lng` but a non-empty `address_line1`, THE `VenueDetailPage` SHALL render a "Get Directions" button that opens `https://www.google.com/maps/search/{encodedQuery}` in a new browser tab, where `encodedQuery` is the URL-encoded concatenation of `venue.name` and `venue.city`.
3. IF a venue has empty `lat`, `lng`, and `address_line1`, THEN THE `VenueDetailPage` SHALL NOT render a directions button.
4. THE `VenueDetailPage` SHALL render the directions button with `target="_blank"` and `rel="noopener noreferrer"` to prevent tab-napping.

---

### Requirement 6: Send Inquiry Feature on VenueDetailPage

**User Story:** As a user interested in a venue, I want to send a quick inquiry message, so that I can ask about availability, pricing, or custom bookings without needing to call.

#### Acceptance Criteria

1. THE `VenueDetailPage` SHALL render a "Send Inquiry" button in the venue header section.
2. WHEN the user clicks "Send Inquiry", THE `VenueDetailPage` SHALL open an `InquiryForm` modal with fields: `name` (text, required), `email` (email, required), and `message` (textarea, required).
3. WHEN the logged-in user's `user.name` and `user.email` are available, THE `InquiryForm` SHALL pre-populate the `name` and `email` fields with those values.
4. WHEN the user submits the `InquiryForm` with all required fields filled and a valid email format, THE `InquiryForm` SHALL submit a `POST /api/venues/{venue_id}/inquiry` request with payload `{ name, email, message }`.
5. IF any required field is empty or the email format is invalid at submission time, THEN THE `InquiryForm` SHALL display a field-level validation error and NOT submit the request.
6. WHEN the inquiry is submitted successfully (HTTP 200), THE `InquiryForm` SHALL close the modal and display a success toast or inline confirmation message.
7. IF the inquiry API returns an error (HTTP 4xx or 5xx), THEN THE `InquiryForm` SHALL display the error message and keep the modal open.
8. THE `Inquiry_API` backend endpoint `POST /api/venues/{venue_id}/inquiry` SHALL accept a JSON body with `name` (string, required), `email` (string, valid email format, required), and `message` (string, required, max 2000 characters).
9. WHEN the `Inquiry_API` receives a valid request, THE `Inquiry_API` SHALL return HTTP 200 with `{ "message": "Inquiry sent" }`.
10. IF the `venue_id` in the path does not correspond to an active venue, THEN THE `Inquiry_API` SHALL return HTTP 404.

---

### Requirement 7: Reviews Section on VenueDetailPage

**User Story:** As a user considering a booking, I want to read reviews and ratings from other users, so that I can make an informed decision about the venue's quality.

#### Acceptance Criteria

1. THE `VenueDetailPage` SHALL render a "Reviews" section below the listings grid that fetches and displays reviews from `GET /api/venues/{venue_id}/reviews`.
2. WHEN reviews are loaded, THE `VenueDetailPage` SHALL display each review's star rating (1–5), reviewer display name, comment text, and submission date.
3. WHEN no reviews exist for the venue, THE `VenueDetailPage` SHALL display a "No reviews yet" placeholder message.
4. WHILE the user is logged in, THE `VenueDetailPage` SHALL display a "Write a review" form below the reviews list.
5. THE "Write a review" form SHALL contain a star rating selector (1–5), a comment textarea (max 500 characters), and a "Submit" button.
6. WHEN the user submits the review form with a rating between 1 and 5 (inclusive) and a comment of 500 characters or fewer, THE `VenueDetailPage` SHALL submit `POST /api/venues/{venue_id}/reviews` with payload `{ listing_id, rating, comment }`.
7. IF the user submits the review form with a rating outside the range 1–5 or a comment exceeding 500 characters, THEN THE `VenueDetailPage` SHALL display a validation error and NOT submit the request.
8. WHEN a review is submitted successfully (HTTP 201), THE `VenueDetailPage` SHALL append the new review to the displayed list without a full page reload.
9. THE `ReviewsAPI` endpoint `GET /api/venues/{venue_id}/reviews` SHALL return a list of review objects, each containing: `id`, `user_display_name`, `listing_id`, `rating`, `comment`, `is_verified_visit`, `created_at`.
10. THE `ReviewsAPI` endpoint `POST /api/venues/{venue_id}/reviews` SHALL require authentication (JWT) and accept a JSON body with `listing_id` (integer, must belong to the venue), `rating` (integer, 1–5 inclusive), `comment` (string, max 500 characters).
11. IF `rating` is outside the range 1–5, THEN THE `ReviewsAPI` SHALL return HTTP 422 with a descriptive validation error.
12. IF `listing_id` does not belong to the specified `venue_id`, THEN THE `ReviewsAPI` SHALL return HTTP 404.
13. WHEN a review is created with a `booking_id` that matches a completed booking for the `listing_id` by the authenticated user, THE `ReviewsAPI` SHALL set `is_verified_visit = true` on the stored review.

---

### Requirement 8: Sport Filter Chips on VenueDetailPage Listings Grid

**User Story:** As a user on a venue detail page, I want to filter the listings by sport/category, so that I can quickly find the specific activity I'm interested in booking.

#### Acceptance Criteria

1. WHEN the `VenueDetailPage` has two or more listings with different `category.slug` values, THE `VenueDetailPage` SHALL render a `SportFilter` chip row at the top of the listings grid.
2. WHEN the `VenueDetailPage` has listings of only one category, THE `VenueDetailPage` SHALL NOT render the `SportFilter` chip row.
3. THE `SportFilter` chip row SHALL include an "All" chip and one chip per distinct `category.slug` present in the venue's listings.
4. WHEN the user clicks a sport chip with slug `S`, THE `VenueDetailPage` SHALL display only listings where `category.slug === S`.
5. WHEN the user clicks the "All" chip, THE `VenueDetailPage` SHALL display all active listings for the venue.
6. WHEN the active sport tab is set via the `?sport` URL parameter (per Requirement 4), THE `SportFilter` row SHALL reflect that selection as the active chip on initial render.
