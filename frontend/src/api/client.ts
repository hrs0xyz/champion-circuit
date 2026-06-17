const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api';

export type ProfilePayload = {
  name: string;
  city: string;
  postal_code: string;
  interests: string[];
  ranked_interests: string[];
  bio: string;
  avatar_url?: string;
  photo_url?: string;
};

export type User = ProfilePayload & {
  id: number;
  username: string;
  email: string;
  auth_provider: string;
  is_admin: boolean;
  created_at: string;
  profile_edit_date: string;
  profile_edits_today: number;
};

type RequestOptions = RequestInit & { token?: string | null };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (options.token) headers.set('Authorization', `Bearer ${options.token}`);

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item?.msg ?? 'Validation error').join(' ')
      : detail ?? 'Something went wrong. Please try again.';
    throw new Error(message);
  }
  return body as T;
}

export const api = {
  interests: () => request<{ interests: string[] }>('/auth/interests'),
  username: (username: string) => request<{ username: string; available: boolean }>(`/auth/username/${encodeURIComponent(username)}`),
  signupStart: (payload: { username: string; email: string; password: string }) =>
    request<{ message: string; dev_otp?: string }>('/auth/signup/start', { method: 'POST', body: JSON.stringify(payload) }),
  signupVerify: (payload: { email: string; otp: string }) =>
    request<{ access_token: string }>('/auth/signup/verify', { method: 'POST', body: JSON.stringify(payload) }),
  login: (payload: { identifier: string; password: string }) =>
    request<{ access_token: string }>('/auth/login', { method: 'POST', body: JSON.stringify(payload) }),
  forgotPassword: (payload: { identifier: string }) =>
    request<{ message: string; dev_otp?: string }>('/auth/password/forgot', { method: 'POST', body: JSON.stringify(payload) }),
  resetPassword: (payload: { identifier: string; otp: string; new_password: string }) =>
    request<{ message: string }>('/auth/password/reset', { method: 'POST', body: JSON.stringify(payload) }),
  google: (payload: { id_token: string }) =>
    request<{ access_token: string }>('/auth/google', { method: 'POST', body: JSON.stringify(payload) }),
  me: (token: string) => request<User>('/auth/me', { token }),
  updateMe: (token: string, payload: ProfilePayload & { current_password: string }) =>
    request<User>('/users/me', { method: 'PUT', token, body: JSON.stringify(payload) }),
  uploadAvatar: async (token: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await fetch(`${API_URL}/uploads/avatar`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(body?.detail ?? 'Could not upload image.');
    return body as { url: string };
  },
};
