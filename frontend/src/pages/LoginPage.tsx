import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  return decodeURIComponent(raw);
}

export function LoginPage() {
  const { setToken } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(identifier.trim(), password);
      await setToken(res.access_token);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="section section-auth">
      <div className="auth-card">
        <div className="auth-card__logo">
          <img src="/branding/cc-mark.png" alt="Champion Circuit" width={48} height={48} />
        </div>
        <h1 className="auth-card__title">Welcome back</h1>
        <p className="auth-card__sub">Log in with your email or username.</p>

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="auth-field">
            <label htmlFor="identifier" className="auth-label">
              Email or username
            </label>
            <input
              id="identifier"
              className="auth-input"
              type="text"
              autoComplete="username"
              placeholder="you@example.com or handle"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              minLength={3}
            />
          </div>

          <div className="auth-field">
            <div className="auth-label-row">
              <label htmlFor="password" className="auth-label">
                Password
              </label>
              <Link to="/forgot-password" className="auth-label-link">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              className="auth-input"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="auth-footer">
          New here?{' '}
          <Link to="/signup" className="auth-footer-link">
            Create an account
          </Link>
        </p>
      </div>
    </section>
  );
}
