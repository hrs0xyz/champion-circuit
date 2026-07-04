import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { LoadingState } from '../components/ui/LoadingState';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState />;
  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

/** No longer needed — profile is always accessible once logged in.
 *  Kept for backward compat with routes that still reference it. */
export function RequireRegistered({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingState label="Checking admin access…" />;
  if (!user || !isAdmin) {
    const next = encodeURIComponent(location.pathname);
    return <Navigate to={`/admin/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

export function RedirectIfAuthed({ children, to = '/' }: { children: ReactNode; to?: string }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState />;
  if (user) return <Navigate to={to} replace />;
  return <>{children}</>;
}
