import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { api } from '../api/client';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'start' | 'verify'>('start');
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function start(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await api.forgotPassword({ identifier });
      setDevOtp(response.dev_otp ?? '');
      setStep('verify');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send OTP.');
    } finally {
      setSubmitting(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api.resetPassword({ identifier, otp, new_password: newPassword });
      navigate('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <p className="eyebrow">Account recovery</p>
        <h1>Reset password</h1>
        {step === 'start' ? (
          <form className="profile-form" onSubmit={start}>
            <label>
              Email or username
              <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} required />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-action" type="submit" disabled={submitting}>
              {submitting ? 'Sending OTP...' : 'Get OTP'}
            </button>
          </form>
        ) : (
          <form className="profile-form" onSubmit={verify}>
            <p className="muted">Enter the OTP sent to your email and choose a new password.</p>
            {devOtp ? <p className="dev-otp">Temporary local OTP: {devOtp}</p> : null}
            <label>
              OTP
              <input value={otp} onChange={(event) => setOtp(event.target.value)} inputMode="numeric" maxLength={6} required />
            </label>
            <label>
              New password
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                minLength={8}
                required
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button className="primary-action" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save password'}
            </button>
          </form>
        )}
        <p className="auth-link">
          Remembered it? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}
