import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { OtpInput } from '../components/ui/OtpInput';

type Step = 'form' | 'otp';

const USERNAME_RE = /^[a-z0-9_]{4,16}$/;

function UsernameStatus({ username }: { username: string }) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!username) { setStatus('idle'); return; }
    if (!USERNAME_RE.test(username.toLowerCase())) { setStatus('invalid'); return; }
    setStatus('checking');
    timerRef.current = setTimeout(() => {
      api.checkUsername(username)
        .then((res) => setStatus(res.available ? 'available' : 'taken'))
        .catch(() => setStatus('idle'));
    }, 500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [username]);

  if (status === 'idle') return null;
  if (status === 'checking') return <span className="username-hint username-hint--checking">Checking…</span>;
  if (status === 'available') return <span className="username-hint username-hint--ok">✓ Available</span>;
  if (status === 'taken') return <span className="username-hint username-hint--err">✗ Already taken</span>;
  return <span className="username-hint username-hint--err">4–16 chars, letters / numbers / _ only</span>;
}

export function SignupPage() {
  const { setToken } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('form');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSignupStart(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!USERNAME_RE.test(username.toLowerCase())) {
      setError('Username must be 4–16 characters: letters, numbers, and _ only.');
      return;
    }
    setLoading(true);
    try {
      await api.signupStart(username.trim().toLowerCase(), email.trim().toLowerCase(), password);
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpVerify(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.signupVerify(email.trim().toLowerCase(), otp.trim());
      await setToken(res.access_token);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired OTP. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setLoading(true);
    try {
      await api.signupStart(username.trim().toLowerCase(), email.trim().toLowerCase(), password);
      setOtp('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend OTP.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'otp') {
    return (
      <section className="section section-auth">
        <div className="auth-card">
          <div className="auth-card__logo">
            <img src="/branding/cc-mark.png" alt="Champion Circuit" width={48} height={48} />
          </div>
          <h1 className="auth-card__title">Check your inbox</h1>
          <p className="auth-card__sub">
            We sent a 6-digit code to <strong>{email}</strong>.
          </p>

          <form className="auth-form" onSubmit={(e) => void handleOtpVerify(e)}>
            <div className="auth-field">
              <label className="auth-label">6-digit code</label>
              <OtpInput value={otp} onChange={setOtp} autoFocus />
            </div>
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit" className="btn btn-primary auth-submit" disabled={loading || otp.length !== 6}>
              {loading ? 'Verifying…' : 'Verify & create account'}
            </button>
          </form>

          <p className="auth-footer">
            Didn't get it?{' '}
            <button type="button" className="auth-footer-link" onClick={() => void handleResend()} disabled={loading}>
              Resend code
            </button>
            {' · '}
            <button type="button" className="auth-footer-link" onClick={() => setStep('form')}>
              Go back
            </button>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="section section-auth">
      <div className="auth-card">
        <div className="auth-card__logo">
          <img src="/branding/cc-mark.png" alt="Champion Circuit" width={48} height={48} />
        </div>
        <h1 className="auth-card__title">Claim your handle</h1>
        <p className="auth-card__sub">Start with the basics. Your sports, city, and bio can come later.</p>

        <form className="auth-form" onSubmit={(e) => void handleSignupStart(e)}>
          <div className="auth-field">
            <label htmlFor="username" className="auth-label">Username</label>
            <div className="auth-input-wrap">
              <input
                id="username"
                className="auth-input"
                type="text"
                autoComplete="username"
                placeholder="your_handle"
                value={username}
                onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16))}
                required
                minLength={4}
                maxLength={16}
              />
              <UsernameStatus username={username} />
            </div>
            <span className="auth-hint">4–16 characters. Letters, numbers, and _ only.</span>
          </div>

          <div className="auth-field">
            <label htmlFor="email" className="auth-label">Email</label>
            <input
              id="email"
              className="auth-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password" className="auth-label">Password</label>
            <input
              id="password"
              className="auth-input"
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
            />
          </div>

          {error ? <p className="auth-error">{error}</p> : null}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Sending OTP…' : 'Continue'}
          </button>
        </form>

        <p className="auth-footer">
          Already signed up?{' '}
          <Link to="/login" className="auth-footer-link">Log in</Link>
        </p>
      </div>
    </section>
  );
}
