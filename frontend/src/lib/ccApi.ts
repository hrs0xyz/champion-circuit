/**
 * ccApi — typed client for all new backend endpoints.
 * Covers: venues, listings, bookings, matches, tournaments,
 *         teams, leaderboard, news, notifications.
 */

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('cc_token');
  const isFormData = init.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try { const b = await res.json(); detail = b.detail ?? detail; } catch { /* */ }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Category {
  id: number; slug: string; name: string; type: string; icon_url: string;
}

export interface VenueCoverPhoto { id: number; url: string; sort_order: number; }

export interface VenuePhoto { id: number; url: string; caption: string; sort_order: number; }

export interface ListingSlot {
  id: number;
  /** 0=Mon … 6=Sun, -1 = specific date */
  day_of_week: number;
  specific_date: string;
  start_time: string; end_time: string;
  max_bookings: number; is_blocked: boolean;
}

export interface VenueListing {
  id: number; venue_id: number;
  category: Category;
  title: string; description: string; rules: string;
  capacity: string; price_per_hour: number; price_per_session: number;
  duration_minutes: number; is_bookable: boolean; is_tournament_eligible: boolean;
  is_active: boolean;
  photos: VenuePhoto[];
  amenities: string[];
  slots: ListingSlot[];
}

export interface Venue {
  id: number; name: string; slug: string;
  description: string; logo_url: string; cover_url: string;
  cover_photos: VenueCoverPhoto[];
  phone: string; email: string; website: string;
  address_line1: string; address_line2?: string;
  city: string; state: string; postal_code: string;
  lat: string; lng: string;
  is_verified: boolean; is_active: boolean;
  listings?: VenueListing[];
}

export interface Booking {
  id: number; listing_id: number;
  booking_date: string; start_time: string; end_time: string;
  status: string; payment_status: string; num_players: number;
}

/** Booking row as returned to venue owners/staff */
export interface StaffBooking {
  id: number; listing_id: number;
  booking_date: string; start_time: string; end_time: string;
  status: string; num_players?: number; user_id: number | null;
}

export interface MyVenueData {
  venue: Venue | null;
  listings?: VenueListing[];
  bookings?: StaffBooking[];
  message?: string;
}

export interface MatchParticipant {
  id: number; user_id: number; team: string; role: string;
  result: string; score: number; rank: number;
  kills: number; assists: number; deaths: number;
  custom_stats: string; points_earned: number; is_disputed: boolean;
}

export interface Match {
  id: number; venue_id: number; listing_id: number;
  tournament_id: number | null;
  match_type: string; game_mode: string; status: string;
  played_at: string; duration_minutes: number; notes: string;
  verified_at: string;
  /** Bracket fields — 0/empty for casual & ranked matches */
  stage_id: number | null;
  round_number: number;
  bracket_position: number;
  next_match_id: number | null;
  next_match_slot: string;
  is_bye: boolean;
  scheduled_at: string;
  participants: MatchParticipant[];
}

export interface LeaderboardRow {
  rank: number; user_id: number; username: string; name: string;
  avatar_url: string; total_points: number; matches_played: number;
  wins: number; losses: number; draws: number;
}

export interface TournamentVenueBrief {
  id: number; name: string; city: string;
  address_line1: string; lat: string; lng: string;
}

export interface Tournament {
  id: number; name: string; slug: string;
  description: string; rules: string; game: string;
  format: string; mode: string;
  max_participants: number; min_participants: number;
  entry_fee_paise: number; prize_pool_paise: number; prize_description: string;
  registration_open: boolean; registration_deadline: string;
  starts_at: string; ends_at: string; status: string;
  is_exclusive: boolean; is_featured: boolean;
  awards_leaderboard_points: boolean;
  banner_url: string;
  participant_count: number;
  venue_id: number | null;
  venue: TournamentVenueBrief | null;
  /** open status + reg flag + deadline not passed + seats left, computed server-side */
  registration_effectively_open: boolean;
}

export interface TournamentStage {
  id: number; tournament_id: number; name: string; stage_order: number;
  venue_id: number | null; venue: TournamentVenueBrief | null;
  is_online: boolean;
  location_name: string; address: string; lat: string; lng: string;
  starts_at: string; ends_at: string; notes: string;
}

export interface TournamentParticipant {
  user_id: number; username: string; name: string; avatar_url: string;
  team_name: string; seed_number: number; checked_in: boolean;
}

export interface TournamentPodiumEntry {
  position: number; user_id: number | null; username: string; name: string;
  team_name: string; points_earned: number; prize_won_paise: number;
}

export interface RosterEntry { user_id: number; name: string; phone: string; }

export interface NextMatchInfo {
  id: number; round_number: number; round_of: number; total_rounds: number;
  status: string; scheduled_at: string; opponent_name: string; venue_name: string;
}

export interface MyRegistration {
  id: number; tournament_id: number; user_id: number;
  team_id: number | null; team_name: string;
  payment_status: string; seed_number: number;
  checked_in_at: string; checkin_code: string;
  contact_name: string; contact_phone: string;
  roster: RosterEntry[]; registered_at: string;
  qr_svg: string;
  next_match: NextMatchInfo | null;
}

export interface TournamentDetail extends Tournament {
  stages: TournamentStage[];
  participants: TournamentParticipant[];
  results: TournamentPodiumEntry[];
  my_registration: MyRegistration | null;
  on_waitlist: boolean;
}

export interface RegisterPayload {
  team_id?: number;
  contact_name?: string;
  contact_phone?: string;
  roster?: RosterEntry[];
}

export interface MyTournamentRegistration {
  tournament: Tournament;
  registration: MyRegistration;
}

export interface BracketSide {
  name: string; user_ids: number[]; score: number; result: string;
}

export interface BracketMatch {
  id: number; round_number: number; bracket_position: number;
  status: string; is_bye: boolean; scheduled_at: string;
  next_match_id: number | null; next_match_slot: string;
  side_a: BracketSide | null; side_b: BracketSide | null;
  winner: string;
}

export interface BracketRound {
  round_number: number; label: string; matches: BracketMatch[];
}

export interface BracketStage {
  id: number; name: string; venue: TournamentVenueBrief | null;
  location_name?: string; starts_at: string; ends_at: string;
  rounds: BracketRound[];
}

export interface BracketData {
  tournament_id: number; slug: string; status: string; format: string;
  total_rounds: number; stages: BracketStage[];
}

export interface StaffParticipant {
  user_id: number; username: string; name: string; phone: string;
  team_name: string; roster: RosterEntry[]; seed_number: number;
  payment_status: string; checked_in_at: string; checkin_code: string;
  registered_at: string;
}

export interface SlotBlockRow {
  stage_id: number; stage_name: string; listing_id: number; listing_title: string;
  date: string; start_time: string; end_time: string; existing_bookings: number;
}

export interface TeamMember {
  user_id: number; username: string; name: string; phone: string; role: string;
}

export interface Team {
  id: number; name: string; tag: string;
  logo_url: string; city: string; is_active?: boolean;
  leader_user_id?: number;
  member_count: number;
  members?: TeamMember[];
}

export interface NewsArticle {
  id: number; title: string; slug: string;
  summary: string; body: string; cover_url: string;
  category: string; tags: string; is_published: boolean;
  published_at: string; view_count: number;
}

export interface Notification {
  id: number; type: string; title: string; body: string;
  link: string; is_read: boolean; created_at: string;
}

export interface Review {
  id: number;
  venue_id: number;
  listing_id: number | null;
  user_id: number;
  username: string;
  rating: number;
  comment: string;
  is_verified_visit: boolean;
  created_at: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const ccApi = {
  // Categories
  categories: () => req<Category[]>('/api/categories'),

  // Venues
  venues: (city = '') =>
    req<Venue[]>(`/api/venues${city ? `?city=${encodeURIComponent(city)}` : ''}`),
  venue: (id: number) => req<Venue>(`/api/venues/${id}`),
  venueListings: (id: number) => req<VenueListing[]>(`/api/venues/${id}/listings`),
  listing: (id: number) => req<VenueListing>(`/api/listings/${id}`),
  createVenue: (payload: object) =>
    req<Venue>('/api/venues', { method: 'POST', body: JSON.stringify(payload) }),
  updateVenue: (id: number, payload: object) =>
    req<Venue>(`/api/venues/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  addListing: (venueId: number, payload: object) =>
    req<VenueListing>(`/api/venues/${venueId}/listings`, { method: 'POST', body: JSON.stringify(payload) }),
  updateListing: (listingId: number, payload: object) =>
    req<VenueListing>(`/api/listings/${listingId}`, { method: 'PUT', body: JSON.stringify(payload) }),
  uploadListingPhoto: (listingId: number, file: File, sortOrder = 1, caption = '') => {
    const form = new FormData();
    form.append('file', file);
    return req<VenuePhoto>(
      `/api/listings/${listingId}/photos?sort_order=${sortOrder}&caption=${encodeURIComponent(caption)}`,
      { method: 'POST', body: form }
    );
  },
  deleteListingPhoto: (listingId: number, photoId: number) =>
    req<{ message: string }>(`/api/listings/${listingId}/photos/${photoId}`, { method: 'DELETE' }),
  setAmenities: (listingId: number, labels: string[]) =>
    req<{ message: string }>(`/api/listings/${listingId}/amenities`, {
      method: 'POST', body: JSON.stringify(labels),
    }),
  addSlot: (listingId: number, payload: object) =>
    req<object>(`/api/listings/${listingId}/slots`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteSlot: (listingId: number, slotId: number) =>
    req<{ message: string }>(`/api/listings/${listingId}/slots/${slotId}`, { method: 'DELETE' }),
  venueBookings: (venueId: number) => req<Booking[]>(`/api/venues/${venueId}/bookings`),
  updateBookingStatus: (bookingId: number, bookingStatus: string) =>
    req<StaffBooking>(`/api/bookings/${bookingId}/status`, {
      method: 'PUT', body: JSON.stringify({ status: bookingStatus }),
    }),

  // Staff portal (venue owner)
  myVenue: () => req<MyVenueData>('/api/staff/my-venue'),
  myTournaments: () => req<Tournament[]>('/api/staff/my-tournaments'),
  assignMatchAdmin: (tournamentId: number, username: string) =>
    req<{ message: string }>(`/api/admin/tournaments/${tournamentId}/assign-match-admin`, {
      method: 'POST', body: JSON.stringify({ username }),
    }),

  // Bookings
  book: (payload: object) =>
    req<Booking & { message: string }>('/api/bookings', { method: 'POST', body: JSON.stringify(payload) }),
  myBookings: () => req<Booking[]>('/api/bookings/me'),

  // Matches
  createMatch: (payload: object) =>
    req<Match>('/api/matches', { method: 'POST', body: JSON.stringify(payload) }),
  matches: (params: Record<string, string | number> = {}) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return req<Match[]>(`/api/matches${qs ? `?${qs}` : ''}`);
  },
  match: (id: number) => req<Match>(`/api/matches/${id}`),
  verifyMatch: (id: number) =>
    req<Match>(`/api/matches/${id}/verify`, { method: 'POST' }),
  myMatches: () => req<Match[]>('/api/matches/me'),

  // Score
  adjustScore: (payload: object) =>
    req<object>('/api/scores/adjust', { method: 'POST', body: JSON.stringify(payload) }),
  userScore: (userId: number) => req<{ user_id: number; total_points: number }>(`/api/scores/user/${userId}`),

  // Leaderboard
  leaderboard: (params: { scope_type?: string; scope_id?: string; period_type?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)]))
    ).toString();
    return req<LeaderboardRow[]>(`/api/leaderboard${qs ? `?${qs}` : ''}`);
  },

  // Tournaments
  tournaments: (params: { status_filter?: string; game?: string; venue_id?: number } = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v).map(([k, v]) => [k, String(v)]))
    ).toString();
    return req<Tournament[]>(`/api/tournaments${qs ? `?${qs}` : ''}`);
  },
  tournament: (id: number) => req<Tournament>(`/api/tournaments/${id}`),
  tournamentBySlug: (slug: string) =>
    req<TournamentDetail>(`/api/tournaments/by-slug/${encodeURIComponent(slug)}`),
  tournamentBracket: (id: number) => req<BracketData>(`/api/tournaments/${id}/bracket`),
  createTournament: (payload: object) =>
    req<Tournament>('/api/tournaments', { method: 'POST', body: JSON.stringify(payload) }),
  updateTournament: (id: number, payload: object) =>
    req<Tournament>(`/api/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  registerTournament: (id: number, payload: RegisterPayload = {}) =>
    req<{ id: number; message: string }>(`/api/tournaments/${id}/register`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  withdrawTournament: (id: number) =>
    req<{ message: string }>(`/api/tournaments/${id}/register`, { method: 'DELETE' }),
  joinTournamentWaitlist: (id: number, payload: RegisterPayload = {}) =>
    req<{ id: number; message: string }>(`/api/tournaments/${id}/waitlist`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  leaveTournamentWaitlist: (id: number) =>
    req<{ message: string }>(`/api/tournaments/${id}/waitlist`, { method: 'DELETE' }),
  myTournamentRegistrations: () =>
    req<MyTournamentRegistration[]>('/api/tournaments/my-registrations'),
  tournamentResults: (id: number, results: object[]) =>
    req<object[]>(`/api/tournaments/${id}/results`, { method: 'POST', body: JSON.stringify(results) }),

  // Tournament management (staff portals)
  adminTournaments: (statusFilter = '') =>
    req<Tournament[]>(`/api/admin/tournaments${statusFilter ? `?status_filter=${statusFilter}` : ''}`),
  assignedTournaments: () => req<Tournament[]>('/api/staff/assigned-tournaments'),
  createVenueTournament: (payload: object) =>
    req<Tournament>('/api/staff/venue-tournaments', { method: 'POST', body: JSON.stringify(payload) }),
  submitTournamentForApproval: (id: number) =>
    req<Tournament>(`/api/staff/tournaments/${id}/submit-for-approval`, { method: 'POST' }),
  approveTournament: (id: number) =>
    req<Tournament>(`/api/admin/tournaments/${id}/approve`, { method: 'POST' }),
  rejectTournament: (id: number, reason = '') =>
    req<Tournament>(`/api/admin/tournaments/${id}/reject`, {
      method: 'POST', body: JSON.stringify({ reason }),
    }),
  cancelTournament: (id: number, reason = '') =>
    req<Tournament>(`/api/admin/tournaments/${id}/cancel`, {
      method: 'POST', body: JSON.stringify({ reason }),
    }),
  tournamentStages: (tournamentId: number) =>
    req<TournamentStage[]>(`/api/admin/tournaments/${tournamentId}/stages`),
  createStage: (tournamentId: number, payload: object) =>
    req<TournamentStage>(`/api/admin/tournaments/${tournamentId}/stages`, {
      method: 'POST', body: JSON.stringify(payload),
    }),
  updateStage: (stageId: number, payload: object) =>
    req<TournamentStage>(`/api/admin/stages/${stageId}`, {
      method: 'PUT', body: JSON.stringify(payload),
    }),
  deleteStage: (stageId: number) =>
    req<{ message: string }>(`/api/admin/stages/${stageId}`, { method: 'DELETE' }),
  generateBracket: (tournamentId: number, roundStageMap: Record<number, number> = {}) =>
    req<BracketData>(`/api/admin/tournaments/${tournamentId}/generate-bracket`, {
      method: 'POST', body: JSON.stringify({ round_stage_map: roundStageMap }),
    }),
  blockTournamentSlots: (tournamentId: number) =>
    req<{ blocked: SlotBlockRow[]; conflicts: SlotBlockRow[] }>(
      `/api/admin/tournaments/${tournamentId}/block-slots`, { method: 'POST' }
    ),
  staffTournamentParticipants: (tournamentId: number) =>
    req<StaffParticipant[]>(`/api/staff/tournaments/${tournamentId}/participants`),
  checkInParticipant: (tournamentId: number, payload: { code?: string; user_id?: number }) =>
    req<{ message: string; user_id: number; checked_in_at: string }>(
      `/api/staff/tournaments/${tournamentId}/check-in`,
      { method: 'POST', body: JSON.stringify(payload) }
    ),
  remindCheckin: (tournamentId: number) =>
    req<{ notified: number }>(`/api/staff/tournaments/${tournamentId}/remind-checkin`, { method: 'POST' }),
  walkoverMatch: (matchId: number, winnerSide: 'A' | 'B', reason = '') =>
    req<Match>(`/api/staff/matches/${matchId}/walkover`, {
      method: 'POST', body: JSON.stringify({ winner_side: winnerSide, reason }),
    }),
  /** Fetches the registrations CSV (Bearer-authenticated) and triggers a download. */
  downloadRegistrationsCsv: async (tournamentId: number, slug: string) => {
    const token = localStorage.getItem('cc_token');
    const res = await fetch(`${BASE}/api/staff/tournaments/${tournamentId}/registrations.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      let detail = `HTTP ${res.status}`;
      try { const b = await res.json(); detail = b.detail ?? detail; } catch { /* */ }
      throw new ApiError(res.status, detail);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}-registrations.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  // Teams
  createTeam: (payload: object) =>
    req<Team>('/api/teams', { method: 'POST', body: JSON.stringify(payload) }),
  myTeams: () => req<Team[]>('/api/teams/me'),
  inviteToTeam: (teamId: number, email: string) =>
    req<object>(`/api/teams/${teamId}/invite?email=${encodeURIComponent(email)}`, { method: 'POST' }),

  // Venue images
  uploadVenueLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return req<{ url: string }>('/api/uploads/venue-logo', { method: 'POST', body: form });
  },
  uploadVenueCover: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return req<VenueCoverPhoto>('/api/uploads/venue-cover', { method: 'POST', body: form });
  },
  deleteVenueCoverPhoto: (venueId: number, photoId: number) =>
    req<{ message: string }>(`/api/venues/${venueId}/cover-photos/${photoId}`, { method: 'DELETE' }),

  // News
  news: (category = '') =>
    req<NewsArticle[]>(`/api/news${category ? `?category=${encodeURIComponent(category)}` : ''}`),
  newsArticle: (id: number) => req<NewsArticle>(`/api/news/${id}`),
  createNews: (payload: object) =>
    req<NewsArticle>('/api/news', { method: 'POST', body: JSON.stringify(payload) }),
  updateNews: (id: number, payload: object) =>
    req<NewsArticle>(`/api/news/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  publishNews: (id: number) =>
    req<NewsArticle>(`/api/news/${id}/publish`, { method: 'POST' }),

  // Notifications
  notifications: (unreadOnly = false) =>
    req<Notification[]>(`/api/notifications${unreadOnly ? '?unread_only=true' : ''}`),
  markNotificationsRead: () =>
    req<{ message: string }>('/api/notifications/read', { method: 'POST' }),

  // Reviews
  venueReviews: (venueId: number) => req<Review[]>(`/api/reviews?venue_id=${venueId}`),
  submitReview: (payload: { venue_id: number; rating: number; comment: string }) =>
    req<Review>('/api/reviews', { method: 'POST', body: JSON.stringify(payload) }),
};
