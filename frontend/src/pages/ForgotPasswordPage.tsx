import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { OtpInput } from '../components/ui/OtpInput';

type Step = 'request' | 'reset' | 'done';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.forgotPasswordStart(identifier.trim());
      setStep('reset');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await api.forgotPasswordReset(identifier.trim(), otp.trim(), newPassword);
      setStep('done');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'done') {
    return (
      <section className="section section-auth">
        <div className="auth-card">
          <div className="auth-card__logo">
            <img src="/branding/cc-mark.png" alt="Champion Circuit" width={48} height={48} />
          </div>
          <h1 className="auth-card__title">Password updated</h1>
          <p className="auth-card__sub">Your password has been reset. You can now log in.</p>
          <button type="button" className="btn btn-primary auth-submit"
            onClick={() => navigate('/login', { replace: true })}>
            Go to login
          </button>
        </div>
      </section>
    );
  }

  if (step === 'reset') {
    return (
      <section className="section section-auth">
        <div className="auth-card">
          <div className="auth-card__logo">
            <img src="/branding/cc-mark.png" alt="Champion Circuit" width={48} height={48} />
          </div>
          <h1 className="auth-card__title">Reset your password</h1>
          <p className="auth-card__sub">
            Enter the 6-digit code sent to your email and choose a new password.
          </p>

          <form className="auth-form" onSubmit={(e) => void handleReset(e)}>
            <div className="auth-field">
              <label className="auth-label">6-digit code</label>
              <OtpInput value={otp} onChange={setOtp} autoFocus />
            </div>
            <div className="auth-field">
              <label htmlFor="new-password" className="auth-label">New password</label>
              <input id="new-password" className="auth-input" type="password"
                autoComplete="new-password" placeholder="At least 8 characters"
                value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                required minLength={8} />
            </div>
            <div className="auth-field">
              <label htmlFor="confirm-password" className="auth-label">Confirm new password</label>
              <input id="confirm-password" className="auth-input" type="password"
                autoComplete="new-password" placeholder="Repeat password"
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                required minLength={8} />
            </div>
            {error ? <p className="auth-error">{error}</p> : null}
            <button type="submit" className="btn btn-primary auth-submit"
              disabled={loading || otp.length !== 6}>
              {loading ? 'Resetting…' : 'Reset password'}
            </button>
          </form>

          <p className="auth-footer">
            <button type="button" className="auth-footer-link" onClick={() => setStep('request')}>
              ← Back
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
        <h1 className="auth-card__title">Forgot password?</h1>
        <p className="auth-card__sub">Enter your email or username and we'll send a reset code.</p>

        <form className="auth-form" onSubmit={(e) => void handleRequest(e)}>
          <div className="auth-field">
            <label htmlFor="identifier" className="auth-label">Email or username</label>
            <input id="identifier" className="auth-input" type="text"
              autoComplete="username" placeholder="you@example.com or handle"
              value={identifier} onChange={(e) => setIdentifier(e.target.value)}
              required minLength={3} />
          </div>
          {error ? <p className="auth-error">{error}</p> : null}
          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send reset code'}
          </button>
        </form>

        <p className="auth-footer">
          Remembered it?{' '}
          <Link to="/login" className="auth-footer-link">Log in</Link>
        </p>
      </div>
    </section>
  );
}
