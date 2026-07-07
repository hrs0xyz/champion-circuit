/**
 * Hidden partner/staff login — not linked from any public page.
 * Access: type /partner-login (or /staff-login) directly in the browser.
 *
 * On successful login:
 *  - is_admin=true  → /staff/admin
 *  - is_venue_owner=true → /staff/venue
 *  - tournament admin → /staff/match
 *  - none of the above → "no staff access" error
 */
import { useEffect, useState, type FormEvent } from 'react';
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

  // Redirect / gate based on role once a user is loaded. Doing this in an
  // effect (not during render) avoids the stale, inconsistent behaviour where
  // a plain player could slip into a staff page on first load.
  useEffect(() => {
    if (!user) return;
    if (user.is_admin) { navigate('/staff/admin', { replace: true }); return; }
    if (user.is_venue_owner) { navigate('/staff/venue', { replace: true }); return; }
    if (user.is_match_admin) { navigate('/staff/match', { replace: true }); return; }
    // Signed in, but this account has no partner/staff role → block (no redirect).
    setError(`This account (@${user.username}) doesn't have partner or staff access. Sign in with your turf-owner account below.`);
    setLoading(false);
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(identifier.trim(), password);
      await setToken(res.access_token);
      // The effect above handles role-gating / redirect once /me loads.
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
      setLoading(false);
    }
  }

  // A staff user is being redirected by the effect — render nothing meanwhile.
  if (user && (user.is_admin || user.is_venue_owner || user.is_match_admin)) {
    return null;
  }

  return (
    <div className="staff-login-page">
      <div className="staff-login-card">
        <img src="/branding/cc-mark.png" alt="Champion Circuit" className="staff-login-logo" />
        <p className="staff-login-eyebrow">Partner Portal</p>
        <h1 className="staff-login-title">Sign in</h1>
        <p className="staff-login-sub">
          For turf owners &amp; Champion Circuit staff.<br />
          Not for regular players.
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
