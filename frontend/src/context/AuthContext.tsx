import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, type UserRead } from '../lib/api';

type AuthContextValue = {
  user: UserRead | null;
  loading: boolean;
  isAdmin: boolean;
  /** Call after receiving a token (login / signup verify) */
  setToken: (token: string) => Promise<void>;
  signOut: () => void;
  /** Refresh user data from server */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserRead | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (): Promise<UserRead | null> => {
    try {
      const me = await api.me();
      setUser(me);
      return me;
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem('cc_token');
        setUser(null);
        return null;
      }
      // Non-401 (e.g. a 500 loading the profile) — surface it to callers
      // instead of silently leaving the user unauthenticated.
      throw err;
    }
  }, []);

  // On mount, if a token exists, load the user
  useEffect(() => {
    const token = localStorage.getItem('cc_token');
    if (!token) {
      setLoading(false);
      return;
    }
    // A transient server error on refresh shouldn't crash the app or log the
    // user out — just leave them unauthenticated for this load.
    fetchMe().catch(() => {}).finally(() => setLoading(false));
  }, [fetchMe]);

  const setToken = useCallback(
    async (token: string) => {
      localStorage.setItem('cc_token', token);
      try {
        const me = await fetchMe();
        if (!me) {
          throw new ApiError(401, 'Signed in, but your session could not be verified. Please try again.');
        }
      } catch (err) {
        // Roll back so the app doesn't look logged-in with no user loaded.
        localStorage.removeItem('cc_token');
        setUser(null);
        // Preserve meaningful client errors (e.g. a 401/403 with a real detail);
        // wrap 500s and network/CORS failures (a server 500 reaches the browser
        // without CORS headers, so it surfaces as a non-ApiError) in a clear message.
        if (err instanceof ApiError && err.status >= 400 && err.status < 500) {
          throw err;
        }
        throw new ApiError(
          err instanceof ApiError ? err.status : 0,
          'Signed in, but we could not load your account. This is usually a temporary server problem — please try again in a moment.',
        );
      }
    },
    [fetchMe],
  );

  const signOut = useCallback(() => {
    localStorage.removeItem('cc_token');
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    await fetchMe();
  }, [fetchMe]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.is_admin ?? false,
      setToken,
      signOut,
      refreshUser,
    }),
    [user, loading, setToken, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
