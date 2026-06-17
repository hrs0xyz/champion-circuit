import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';

import { GoogleButton } from '../components/GoogleButton';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(identifier, password);
      navigate('/profile');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log in.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Welcome back</p>
        <h1>Login</h1>
        <form className="profile-form" onSubmit={submit}>
          <label>
            Email or username
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required />
          </label>
          <label>
            Password
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required />
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action" type="submit" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Login'}
          </button>
          <GoogleButton
            label="Login with Google"
            onToken={async (token) => {
              await googleLogin(token);
              navigate('/profile');
            }}
          />
        </form>
        <p className="auth-link">
          New here? <Link to="/signup">Create your profile</Link>
        </p>
        <p className="auth-link">
          Forgot password? <Link to="/forgot-password">Reset it</Link>
        </p>
      </section>
    </main>
  );
}
