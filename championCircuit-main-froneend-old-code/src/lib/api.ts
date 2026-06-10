const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('cc_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      detail = body.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export interface UserRead {
  id: number;
  username: string;
  email: string;
  name: string;
  display_name: string;
  gender: string;
  date_of_birth: string;
  phone: string;
  city: string;
  state: string;
  postal_code: string;
  interests: string[];
  ranked_interests: string[];
  bio: string;
  avatar_url: string;
  photo_url: string;
  auth_provider: string;
  is_admin: boolean;
  is_verified: boolean;
  is_venue_owner: boolean;
  created_at: string;
  profile_edit_date: string;
  profile_edits_today: number;
}

export interface SignupStartResponse {
  message: string;
  dev_otp?: string | null;
}

export interface UsernameAvailability {
  username: string;
  available: boolean;
}

export const api = {
  // Check username availability
  checkUsername: (username: string) =>
    request<UsernameAvailability>(`/api/auth/username/${encodeURIComponent(username)}`),

  // Start signup — sends OTP
  signupStart: (username: string, email: string, password: string) =>
    request<SignupStartResponse>('/api/auth/signup/start', {
      method: 'POST',
      body: JSON.stringify({ username, email, password }),
    }),

  // Verify OTP → get token
  signupVerify: (email: string, otp: string) =>
    request<TokenResponse>('/api/auth/signup/verify', {
      method: 'POST',
      body: JSON.stringify({ email, otp }),
    }),

  // Login with email or username
  login: (identifier: string, password: string) =>
    request<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password }),
    }),

  // Forgot password — send OTP
  forgotPasswordStart: (identifier: string) =>
    request<{ message: string; dev_otp?: string | null }>('/api/auth/password/forgot', {
      method: 'POST',
      body: JSON.stringify({ identifier }),
    }),

  // Reset password with OTP
  forgotPasswordReset: (identifier: string, otp: string, new_password: string) =>
    request<{ message: string }>('/api/auth/password/reset', {
      method: 'POST',
      body: JSON.stringify({ identifier, otp, new_password }),
    }),

  // Google login
  googleLogin: (id_token: string) =>
    request<TokenResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ id_token }),
    }),

  // Get current user
  me: () => request<UserRead>('/api/auth/me'),

  // Update profile
  updateProfile: (payload: {
    name: string;
    city: string;
    postal_code: string;
    interests: string[];
    ranked_interests: string[];
    bio: string;
    current_password: string;
  }) =>
    request<UserRead>('/api/users/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  // Upload avatar
  uploadAvatar: (file: File) => {
    const token = localStorage.getItem('cc_token');
    const form = new FormData();
    form.append('file', file);
    return fetch(`${BASE}/api/uploads/avatar`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new ApiError(res.status, body.detail ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<{ url: string }>;
    });
  },
};
