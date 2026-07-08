# Bugfix Requirements Document

## Introduction

The Turf Owner portal (`/staff/venue` → "My Venue" tab) uses raw text inputs for `logo_url` and `cover_url` in the `VenueEditor` component. Venue owners are expected to upload images (logo + cover photos) via file pickers that upload to Cloudinary — not paste raw URLs. Additionally, the venue data model only stores a single `cover_url` string, while the requirement is to support 0–3 cover images. No venue-specific upload endpoints exist on the backend. This bugfix replaces the raw URL inputs with proper file-upload UI and adds the necessary backend and data model support, following the existing `PhotoManager` and `news-image` upload patterns already in the codebase.

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a turf owner visits the "My Venue" tab in the Turf Owner portal THEN the system displays a plain text input field for `logo_url` instead of a file upload control

1.2 WHEN a turf owner visits the "My Venue" tab in the Turf Owner portal THEN the system displays a plain text input field for `cover_url` instead of a file upload control

1.3 WHEN a turf owner attempts to set a venue logo THEN the system requires them to paste a raw image URL, with no mechanism to upload a file directly

1.4 WHEN a turf owner attempts to set cover images THEN the system only supports a single cover image via raw URL, not 0–3 uploadable images

1.5 WHEN a turf owner submits a file to any upload endpoint for venue images THEN the system returns a 404 because no `/api/uploads/venue-logo` or `/api/uploads/venue-cover` endpoint exists

1.6 WHEN a venue is displayed on `/venue/:id` or the `/turf` browse page THEN the system cannot reliably render a cover banner or logo because owners have no practical way to provide valid hosted image URLs

### Expected Behavior (Correct)

2.1 WHEN a turf owner visits the "My Venue" tab THEN the system SHALL display a file picker control for the venue logo (0 or 1 image) with upload, preview, and remove capability — replacing the raw `logo_url` text input

2.2 WHEN a turf owner visits the "My Venue" tab THEN the system SHALL display a file picker control for cover images (0–3 images, added one at a time) with upload, preview, and individual remove capability — replacing the raw `cover_url` text input

2.3 WHEN a turf owner selects an image file for the venue logo THEN the system SHALL upload the file to Cloudinary via `POST /api/uploads/venue-logo`, persist the returned URL to `venues.logo_url`, and display a preview immediately

2.4 WHEN a turf owner selects an image file for a cover photo THEN the system SHALL upload the file to Cloudinary via `POST /api/uploads/venue-cover`, persist the returned URL in the `venue_cover_photos` table (max 3 rows per venue), and display the image in the cover photo grid immediately

2.5 WHEN a turf owner removes the venue logo THEN the system SHALL clear `venues.logo_url` and remove the preview without affecting any other venue data

2.6 WHEN a turf owner removes a cover image THEN the system SHALL delete the corresponding row from `venue_cover_photos` and remove it from the grid without affecting the remaining cover images or any other venue data

2.7 WHEN the cover photo grid already contains 3 images THEN the system SHALL hide the "Add photo" control so no further uploads are possible until one is removed

2.8 WHEN a venue's logo and cover images are set THEN the system SHALL display the logo and cover images on the public `/venue/:id` page (hero/banner area) and on the `/turf` browse page (venue cards)

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a turf owner edits and saves any other venue field (name, phone, email, address, description, etc.) THEN the system SHALL CONTINUE TO save those fields correctly and display the success message

3.2 WHEN a turf owner creates a new venue for the first time THEN the system SHALL CONTINUE TO create the venue with no logo and no cover images (both optional, defaulting to empty)

3.3 WHEN a turf owner manages listings, photos, amenities, or slots THEN the system SHALL CONTINUE TO function exactly as before — the `PhotoManager` component and listing photo upload flow are unaffected

3.4 WHEN an authenticated user uploads an avatar via `POST /api/uploads/avatar` THEN the system SHALL CONTINUE TO upload to Cloudinary and save the URL to the user's profile as before

3.5 WHEN an admin uploads a news image via `POST /api/uploads/news-image` THEN the system SHALL CONTINUE TO upload to Cloudinary and return the URL as before

3.6 WHEN a non-venue-owner user attempts to call `POST /api/uploads/venue-logo` or `POST /api/uploads/venue-cover` THEN the system SHALL CONTINUE TO reject the request with a 403 Forbidden response

3.7 WHEN the public `/turf` browse page or `/venue/:id` page is viewed for a venue with no logo or cover images THEN the system SHALL CONTINUE TO render gracefully with placeholder or no-image fallback UI
