/**
 * Match Admin Login — /match-admin-login
 * Dedicated login page for tournament match administrators.
 * After successful login, redirects to /staff/match portal.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, ApiError } from '../../lib/api';

export function MatchAdminLoginPage() {
  const { setToken, user } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Match admins, venue owners, and super admins can all access the match portal
    if (user.is_match_admin || user.is_venue_owner || user.is_admin) {
      navigate('/staff/match', { replace: true });
      return;
    }
    // User logged in but doesn't have match admin access
    setError(`This account (@${user.username}) doesn't have match admin access. Contact a tournament organizer to get assigned.`);
    setLoading(false);
  }, [user, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.login(identifier.trim(), password);
      await setToken(res.access_token);
      // Effect above handles redirect once user data loads
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
      setLoading(false);
    }
  }

  // Redirecting - show nothing meanwhile
  if (user && (user.is_match_admin || user.is_venue_owner || user.is_admin)) {
    return null;
  }

  return (
    <div className="staff-login-page">
      <div className="staff-login-card">
        <img src="/branding/cc-mark.png" alt="Champion Circuit" className="staff-login-logo" />
        <div style={{ textAlign: 'center', fontSize: '48px', marginBottom: '8px' }}>🎮</div>
        <p className="staff-login-eyebrow">Match Admin Portal</p>
        <h1 className="staff-login-title">Sign in</h1>
        <p className="staff-login-sub">
          For tournament match administrators.<br />
          Manage check-ins, matches, and brackets.
        </p>

        <form className="auth-form" onSubmit={(e) => void handleSubmit(e)}>
          <div className="auth-field">
            <label className="auth-label">Username or email</label>
            <input
              className="auth-input"
              type="text"
              placeholder="your-username or email@..."
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
            {loading ? 'Signing in…' : 'Sign in as match admin'}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '13px', color: '#71717a' }}>
          <p>Not a match admin yet?</p>
          <p style={{ marginTop: '8px' }}>Ask your tournament organizer to assign you via @username</p>
        </div>
      </div>
    </div>
  );
}
