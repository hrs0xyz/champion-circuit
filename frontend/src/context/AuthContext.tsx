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

  const fetchMe = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        localStorage.removeItem('cc_token');
        setUser(null);
      }
    }
  }, []);

  // On mount, if a token exists, load the user
  useEffect(() => {
    const token = localStorage.getItem('cc_token');
    if (!token) {
      setLoading(false);
      return;
    }
    fetchMe().finally(() => setLoading(false));
  }, [fetchMe]);

  const setToken = useCallback(
    async (token: string) => {
      localStorage.setItem('cc_token', token);
      await fetchMe();
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
