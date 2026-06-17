import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, type ProfilePayload, type User } from '../api/client';

const TOKEN_KEY = 'cc_access_token';

type AuthContextValue = {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  signupStart: (payload: { username: string; email: string; password: string }) => Promise<{ dev_otp?: string }>;
  signupVerify: (payload: { email: string; otp: string }) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  updateProfile: (payload: ProfilePayload & { current_password: string }) => Promise<void>;
  uploadAvatar: (file: File) => Promise<string>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(Boolean(token));

  const saveToken = useCallback((nextToken: string) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .me(token)
      .then(setUser)
      .catch(logout)
      .finally(() => setLoading(false));
  }, [token, logout]);

  const login = useCallback(
    async (identifier: string, password: string) => {
      const response = await api.login({ identifier, password });
      saveToken(response.access_token);
      setUser(await api.me(response.access_token));
    },
    [saveToken],
  );

  const signupStart = useCallback(async (payload: { username: string; email: string; password: string }) => {
    return api.signupStart(payload);
  }, []);

  const signupVerify = useCallback(
    async (payload: { email: string; otp: string }) => {
      const response = await api.signupVerify(payload);
      saveToken(response.access_token);
      setUser(await api.me(response.access_token));
    },
    [saveToken],
  );

  const googleLogin = useCallback(
    async (idToken: string) => {
      const response = await api.google({ id_token: idToken });
      saveToken(response.access_token);
      setUser(await api.me(response.access_token));
    },
    [saveToken],
  );

  const updateProfile = useCallback(
    async (payload: ProfilePayload & { current_password: string }) => {
      if (!token) throw new Error('Please log in again.');
      setUser(await api.updateMe(token, payload));
    },
    [token],
  );

  const uploadAvatar = useCallback(
    async (file: File) => {
      if (!token) throw new Error('Please log in again.');
      const uploaded = await api.uploadAvatar(token, file);
      return uploaded.url;
    },
    [token],
  );

  const value = useMemo(
    () => ({ user, token, loading, login, signupStart, signupVerify, googleLogin, updateProfile, uploadAvatar, logout }),
    [user, token, loading, login, signupStart, signupVerify, googleLogin, updateProfile, uploadAvatar, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
