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

export interface VenuePhoto { id: number; url: string; caption: string; sort_order: number; }

export interface VenueListing {
  id: number; venue_id: number;
  category: Category;
  title: string; description: string; rules: string;
  capacity: number; price_per_hour: number; price_per_session: number;
  duration_minutes: number; is_bookable: boolean; is_tournament_eligible: boolean;
  is_active: boolean;
  photos: VenuePhoto[];
  amenities: string[];
}

export interface Venue {
  id: number; name: string; slug: string;
  description: string; logo_url: string; cover_url: string;
  phone: string; email: string; website: string;
  address_line1: string; city: string; state: string; postal_code: string;
  lat: string; lng: string;
  is_verified: boolean; is_active: boolean;
  listings?: VenueListing[];
}

export interface Booking {
  id: number; listing_id: number;
  booking_date: string; start_time: string; end_time: string;
  status: string; payment_status: string; num_players: number;
}

export interface MatchParticipant {
  id: number; user_id: number; team: string; role: string;
  result: string; score: number; rank: number;
  kills: number; assists: number; deaths: number;
  custom_stats: string; points_earned: number; is_disputed: boolean;
}

export interface Match {
  id: number; venue_id: number; listing_id: number;
  match_type: string; game_mode: string; status: string;
  played_at: string; duration_minutes: number; notes: string;
  verified_at: string;
  participants: MatchParticipant[];
}

export interface LeaderboardRow {
  rank: number; user_id: number; username: string; name: string;
  avatar_url: string; total_points: number; matches_played: number;
  wins: number; losses: number; draws: number;
}

export interface Tournament {
  id: number; name: string; slug: string;
  description: string; rules: string; game: string;
  format: string; mode: string; max_participants: number;
  entry_fee_paise: number; prize_pool_paise: number; prize_description: string;
  registration_open: boolean; registration_deadline: string;
  starts_at: string; ends_at: string; status: string;
  is_exclusive: boolean; is_featured: boolean; banner_url: string;
  participant_count: number;
}

export interface Team {
  id: number; name: string; tag: string;
  logo_url: string; city: string; is_active: boolean; member_count: number;
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
  uploadListingPhoto: (listingId: number, file: File, sortOrder = 1, caption = '') => {
    const form = new FormData();
    form.append('file', file);
    return req<VenuePhoto>(
      `/api/listings/${listingId}/photos?sort_order=${sortOrder}&caption=${encodeURIComponent(caption)}`,
      { method: 'POST', body: form }
    );
  },
  setAmenities: (listingId: number, labels: string[]) =>
    req<{ message: string }>(`/api/listings/${listingId}/amenities`, {
      method: 'POST', body: JSON.stringify(labels),
    }),
  addSlot: (listingId: number, payload: object) =>
    req<object>(`/api/listings/${listingId}/slots`, { method: 'POST', body: JSON.stringify(payload) }),
  venueBookings: (venueId: number) => req<Booking[]>(`/api/venues/${venueId}/bookings`),

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
  createTournament: (payload: object) =>
    req<Tournament>('/api/tournaments', { method: 'POST', body: JSON.stringify(payload) }),
  updateTournament: (id: number, payload: object) =>
    req<Tournament>(`/api/tournaments/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  registerTournament: (id: number, teamId = 0) =>
    req<{ id: number; message: string }>(
      `/api/tournaments/${id}/register${teamId ? `?team_id=${teamId}` : ''}`,
      { method: 'POST' }
    ),
  tournamentResults: (id: number, results: object[]) =>
    req<object[]>(`/api/tournaments/${id}/results`, { method: 'POST', body: JSON.stringify(results) }),

  // Teams
  createTeam: (payload: object) =>
    req<Team>('/api/teams', { method: 'POST', body: JSON.stringify(payload) }),
  myTeams: () => req<Team[]>('/api/teams/me'),
  inviteToTeam: (teamId: number, email: string) =>
    req<object>(`/api/teams/${teamId}/invite?email=${encodeURIComponent(email)}`, { method: 'POST' }),

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
};
