import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';
import { LoadingState } from '../../components/ui/LoadingState';

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith('/admin')) return '/admin';
  return decodeURIComponent(raw);
}

export function AdminLoginPage() {
  const { user, loading, isAdmin, setToken } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user && isAdmin) navigate(next, { replace: true });
  }, [loading, user, isAdmin, navigate, next]);

  if (loading) return <LoadingState label="Checking access…" />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await api.login(identifier.trim(), password);
      await setToken(res.access_token);
      // RequireAdmin guard will redirect if not admin
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-login">
      <div className="admin-login__panel">
        <p className="admin-login__eyebrow">Champion Circuit</p>
        <h1>Admin sign in</h1>
        <p className="muted">Internal staff only.</p>
        <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="auth-input"
            type="text"
            placeholder="Email or username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
          />
          <input
            className="auth-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <p className="auth-error">{error}</p> : null}
          {user && !isAdmin ? (
            <p className="auth-error">This account does not have admin access.</p>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}
