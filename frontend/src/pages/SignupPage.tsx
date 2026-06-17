import { CheckCircle2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../api/client';
import { GoogleButton } from '../components/GoogleButton';
import { useAuth } from '../context/AuthContext';

type Step = 'account' | 'otp';

export function SignupPage() {
  const { signupStart, signupVerify, googleLogin } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('account');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [usernameState, setUsernameState] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const cleanUsername = useMemo(() => username.trim().toLowerCase(), [username]);

  useEffect(() => {
    if (cleanUsername.length < 3) {
      setUsernameState('idle');
      return;
    }
    const timer = window.setTimeout(() => {
      setUsernameState('checking');
      api
        .username(cleanUsername)
        .then((result) => setUsernameState(result.available ? 'available' : 'taken'))
        .catch(() => setUsernameState('idle'));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [cleanUsername]);

  async function startSignup(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (usernameState === 'taken') {
      setError('That username is already taken.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await signupStart({ username: cleanUsername, email, password });
      setDevOtp(response.dev_otp ?? '');
      setStep('otp');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start signup.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signupVerify({ email, otp });
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not verify OTP.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Claim your handle</p>
        <h1>Signup</h1>
        <p className="muted">Start with the basics. Your sports, city, avatar, and bio can come later.</p>

        {step === 'account' ? (
          <form className="profile-form" onSubmit={startSignup}>
            <label>
              Username
              <input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="champion_07"
                autoComplete="username"
                minLength={4}
                maxLength={16}
                pattern="[A-Za-z0-9_]+"
                required
              />
            </label>
            <p className={`username-hint ${usernameState}`}>
              {usernameState === 'checking'
                ? 'Checking username...'
                : usernameState === 'available'
                  ? `${cleanUsername} is available. Nice.`
                  : usernameState === 'taken'
                    ? `${cleanUsername} is taken. Try a sharper one.`
                    : '4-16 characters. Letters, numbers, underscore only.'}
            </p>
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="form-actions">
              <button className="primary-action" type="submit" disabled={submitting || usernameState === 'taken'}>
                <Sparkles size={18} />
                {submitting ? 'Sending OTP...' : 'Get OTP'}
              </button>
              <GoogleButton
                onToken={async (token) => {
                  await googleLogin(token);
                  navigate('/profile');
                }}
              />
            </div>
          </form>
        ) : (
          <form className="profile-form" onSubmit={verifyOtp}>
            <div className="otp-card">
              <CheckCircle2 />
              <div>
                <strong>OTP sent</strong>
                <p className="muted">Enter the 6 digit code sent to {email}.</p>
              </div>
            </div>
            {devOtp ? <p className="dev-otp">Local dev OTP: {devOtp}</p> : null}
            <label>
              OTP
              <input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" maxLength={6} required />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <div className="form-actions">
              <button className="primary-action" type="submit" disabled={submitting}>
                {submitting ? 'Verifying...' : 'Create profile'}
              </button>
              <button className="secondary-action" type="button" onClick={() => setStep('account')}>
                Edit details
              </button>
            </div>
          </form>
        )}

        <p className="auth-link">
          Already signed up? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
