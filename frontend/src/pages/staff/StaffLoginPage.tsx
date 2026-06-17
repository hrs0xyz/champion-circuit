/**
 * Hidden staff login — not linked from any public page.
 * Access: type /staff-login directly in the browser.
 *
 * On successful login:
 *  - is_admin=true  → /staff/admin
 *  - is_venue_owner=true → /staff/venue
 *  - tournament admin → /staff/match
 *  - none of the above → "no staff access" error
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';

export function StaffLoginPage() {
  const { setToken, user } = useAuth();
  const navigate = useNavigate();
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
      // setToken fetches /me — check role after
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
      setLoading(false);
      return;
    }
    setLoading(false);
  }

  // After token is set, user is loaded — redirect based on role
  if (user) {
    if (user.is_admin) {
      navigate('/staff/admin', { replace: true });
    } else if (user.is_venue_owner) {
      navigate('/staff/venue', { replace: true });
    } else {
      // Could be a match admin — send to match admin portal
      navigate('/staff/match', { replace: true });
    }
    return null;
  }

  return (
    <div className="staff-login-page">
      <div className="staff-login-card">
        <img src="/branding/cc-mark.png" alt="Champion Circuit" className="staff-login-logo" />
        <p className="staff-login-eyebrow">Staff Portal</p>
        <h1 className="staff-login-title">Sign in</h1>
        <p className="staff-login-sub">
          This page is for Champion Circuit staff only.<br />
          Not for regular users.
        </p>

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="auth-field">
            <label className="auth-label">Username or email</label>
            <input
              className="auth-input"
              type="text"
              placeholder="admin or turf@..."
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label className="auth-label">Password</label>
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in to staff portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
