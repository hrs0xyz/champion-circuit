import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Image, Sparkles } from 'lucide-react';

import { api, type ProfilePayload } from '../api/client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

type ProfileFormProps = {
  mode: 'signup' | 'profile';
  initial?: Partial<ProfilePayload> & { email?: string };
  onSubmit: (payload: ProfilePayload & { email?: string; password?: string; current_password?: string; id_token?: string }) => Promise<void>;
  onUploadAvatar?: (file: File) => Promise<string>;
  showCredentials?: boolean;
  showGoogle?: boolean;
};

const fallbackInterests = ['Cricket', 'Badminton', 'Football', 'PUBG', 'BGMI', 'Valorant', 'FIFA', 'Fitness'];

export function ProfileForm({ mode, initial, onSubmit, onUploadAvatar, showCredentials = false, showGoogle = false }: ProfileFormProps) {
  const [interests, setInterests] = useState(fallbackInterests);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleReady, setGoogleReady] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [form, setForm] = useState<ProfilePayload>({
    name: initial?.name ?? '',
    city: initial?.city ?? '',
    postal_code: initial?.postal_code ?? '',
    interests: initial?.interests ?? [],
    ranked_interests: initial?.ranked_interests ?? [],
    bio: initial?.bio ?? '',
    avatar_url: initial?.avatar_url ?? '',
    photo_url: initial?.photo_url ?? '',
  });

  useEffect(() => {
    api.interests().then((data) => setInterests(data.interests)).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!showGoogle) return;
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) return;

    const initialize = () => {
      window.google?.accounts.id.initialize({
        client_id: clientId,
        callback: (response) => {
          if (!response.credential) {
            setError('Google did not return a sign-in token.');
            return;
          }
          void submit({ id_token: response.credential });
        },
      });
      setGoogleReady(Boolean(window.google));
    };

    const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      initialize();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = initialize;
    document.head.appendChild(script);
  }, [showGoogle]);

  const ranked = useMemo(() => {
    const selected = form.ranked_interests.filter((item) => form.interests.includes(item));
    const missing = form.interests.filter((item) => !selected.includes(item));
    return [...selected, ...missing];
  }, [form.interests, form.ranked_interests]);

  function toggleInterest(interest: string) {
    setForm((current) => {
      const exists = current.interests.includes(interest);
      return {
        ...current,
        interests: exists ? current.interests.filter((item) => item !== interest) : [...current.interests, interest],
        ranked_interests: exists ? current.ranked_interests.filter((item) => item !== interest) : [...current.ranked_interests, interest],
      };
    });
  }

  function moveInterest(index: number, direction: -1 | 1) {
    const next = [...ranked];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setForm((current) => ({ ...current, ranked_interests: next }));
  }

  async function submit(extra: { id_token?: string } = {}) {
    setError('');
    if (!form.name || !form.city || !form.postal_code || form.interests.length === 0) {
      setError('Name, city, postal code, and at least one interest are required.');
      return;
    }
    if (showCredentials && (!email || password.length < 8)) {
      setError('Enter an email and a password with at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        avatar_url: form.avatar_url?.trim() || undefined,
        photo_url: form.photo_url?.trim() || undefined,
        ranked_interests: ranked,
        email,
        password,
        current_password: currentPassword,
        ...extra,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      className="profile-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      {showCredentials ? (
        <div className="form-grid two">
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
        </div>
      ) : null}

      <div className="form-grid two">
        <label>
          Name
          <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
        </label>
        <label>
          City
          <input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} required />
        </label>
      </div>

      <label>
        Postal code
        <input value={form.postal_code} onChange={(event) => setForm({ ...form, postal_code: event.target.value })} required />
      </label>

      <div className="field-block">
        <div className="field-label">Interests</div>
        <div className="interest-grid">
          {interests.map((interest) => (
            <button
              className={form.interests.includes(interest) ? 'chip selected' : 'chip'}
              key={interest}
              type="button"
              onClick={() => toggleInterest(interest)}
            >
              {form.interests.includes(interest) ? <Check size={15} /> : null}
              {interest}
            </button>
          ))}
        </div>
      </div>

      {ranked.length ? (
        <div className="rank-box">
          <div className="field-label">Rank your interests</div>
          {ranked.map((interest, index) => (
            <div className="rank-row" key={interest}>
              <span>{index + 1}</span>
              <strong>{interest}</strong>
              <div>
                <button type="button" className="icon-button small" onClick={() => moveInterest(index, -1)} aria-label={`Move ${interest} up`}>
                  <ArrowUp size={15} />
                </button>
                <button type="button" className="icon-button small" onClick={() => moveInterest(index, 1)} aria-label={`Move ${interest} down`}>
                  <ArrowDown size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <label>
        Tell us about yourself
        <textarea value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} rows={5} maxLength={600} />
      </label>

      <div className="form-grid two">
        <label>
          Avatar upload
          <span className="input-with-icon">
            <Image size={17} />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={!onUploadAvatar || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || !onUploadAvatar) return;
                setUploading(true);
                setError('');
                void onUploadAvatar(file)
                  .then((url) => setForm((current) => ({ ...current, avatar_url: url })))
                  .catch((err) => setError(err instanceof Error ? err.message : 'Could not upload image.'))
                  .finally(() => setUploading(false));
              }}
            />
          </span>
        </label>
        <label>
          Cover photo upload
          <span className="input-with-icon">
            <Image size={17} />
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={!onUploadAvatar || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file || !onUploadAvatar) return;
                setUploading(true);
                setError('');
                void onUploadAvatar(file)
                  .then((url) => setForm((current) => ({ ...current, photo_url: url })))
                  .catch((err) => setError(err instanceof Error ? err.message : 'Could not upload image.'))
                  .finally(() => setUploading(false));
              }}
            />
          </span>
        </label>
      </div>
      {uploading ? <p className="muted">Uploading image...</p> : null}

      {mode === 'profile' ? (
        <label>
          Current password
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
      ) : null}

      {error ? <p className="form-error">{error}</p> : null}

      <div className="form-actions">
        <button className="primary-action" type="submit" disabled={submitting}>
          <Sparkles size={18} />
          {submitting ? 'Saving...' : mode === 'signup' ? 'Create profile' : 'Save profile'}
        </button>
        {showGoogle ? (
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
                setError('Set VITE_GOOGLE_CLIENT_ID to enable Google signup.');
                return;
              }
              if (!googleReady || !window.google) {
                setError('Google sign-in is still loading. Try again in a moment.');
                return;
              }
              window.google.accounts.id.prompt();
            }}
          >
            Continue with Google
          </button>
        ) : null}
      </div>
    </form>
  );
}
