import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import { PageContainer } from '../components/ui/PageContainer';
import { LoadingState } from '../components/ui/LoadingState';

function safeNext(raw: string | null) {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/turf';
  return decodeURIComponent(raw);
}

export function RegisterPage() {
  const { user, loading } = useAuth();
  const { profile, setProfile, registered, completeRegistration, cloudStatus } = usePlatform();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = safeNext(params.get('next'));
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && registered && user) navigate(next, { replace: true });
  }, [loading, registered, user, navigate, next]);

  if (loading) return <LoadingState />;

  if (!user) {
    return (
      <section className="section section-register">
        <PageContainer narrow>
          <div className="section-head">
            <h1>Register</h1>
            <p>Sign in first, then complete your Champion Circuit profile.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => navigate(`/login?next=${encodeURIComponent(next)}`)}>
            Continue with Google
          </button>
          <p className="auth-inline muted small">
            <span className="auth-inline__text">Already have an account?</span>
            <Link className="auth-inline__link" to={`/login?next=${encodeURIComponent(next)}`}>
              Log in
            </Link>
          </p>
        </PageContainer>
      </section>
    );
  }

  return (
    <section className="section section-register">
      <PageContainer narrow>
        <div className="section-head">
          <h1>Complete your profile</h1>
          <p>Required once to unlock booking and tournament registration.</p>
        </div>
        <form
          className="platform-form"
          onSubmit={(e) => {
            const err = completeRegistration(e);
            setMessage(err);
            if (!err) navigate(next, { replace: true });
          }}
        >
          <input placeholder="Name *" value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} required />
          <input
            placeholder="Email *"
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({ ...profile, email: e.target.value })}
            required
          />
          <input
            placeholder="Contact number *"
            value={profile.contactNumber}
            onChange={(e) => setProfile({ ...profile, contactNumber: e.target.value })}
            required
          />
          <input placeholder="City *" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} required />
          <input
            placeholder="Age *"
            type="number"
            min={10}
            value={profile.age || ''}
            onChange={(e) => setProfile({ ...profile, age: Number(e.target.value) })}
            required
          />
          <input placeholder="In-game name (optional)" value={profile.ign ?? ''} onChange={(e) => setProfile({ ...profile, ign: e.target.value })} />
          <input
            placeholder="Profile picture URL (optional)"
            value={profile.profilePicture ?? ''}
            onChange={(e) => setProfile({ ...profile, profilePicture: e.target.value })}
          />
          <button type="submit" className="btn btn-primary">
            Save &amp; continue
          </button>
        </form>
        {message ? <p className="form-feedback form-feedback--error">{message}</p> : null}
        {cloudStatus ? <p className="muted small">{cloudStatus}</p> : null}
      </PageContainer>
    </section>
  );
}
