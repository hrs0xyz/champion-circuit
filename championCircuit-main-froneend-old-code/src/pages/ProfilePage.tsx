import { useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api, ApiError } from '../lib/api';
import { CitySelect } from '../components/ui/CitySelect';

const INTERESTS = [
  'Cricket', 'Badminton', 'Football', 'Basketball', 'Table Tennis',
  'PUBG', 'BGMI', 'Valorant', 'Free Fire', 'FIFA', 'Content Creation', 'Fitness',
];

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

function avatarSrc(url: string | undefined) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url}`;
}

export function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Edit form state
  const [name, setName] = useState(user?.name ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [postalCode, setPostalCode] = useState(user?.postal_code ?? '');
  const [bio, setBio] = useState(user?.bio ?? '');
  const [interests, setInterests] = useState<string[]>(user?.interests ?? []);
  const [currentPassword, setCurrentPassword] = useState('');

  if (!user) return null;

  const src = avatarSrc(user.avatar_url || user.photo_url);
  const initial = (user.name?.[0] ?? user.username?.[0] ?? 'C').toUpperCase();

  function startEdit() {
    setName(user!.name ?? '');
    setCity(user!.city ?? '');
    setPostalCode(user!.postal_code ?? '');
    setBio(user!.bio ?? '');
    setInterests(user!.interests ?? []);
    setCurrentPassword('');
    setError('');
    setSuccess('');
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError('');
  }

  function toggleInterest(interest: string) {
    setInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest],
    );
  }

  async function handleSave() {
    setError('');
    if (!currentPassword) {
      setError('Enter your current password to save changes.');
      return;
    }
    setSaving(true);
    try {
      await api.updateProfile({
        name,
        city,
        postal_code: postalCode,
        interests,
        ranked_interests: interests,
        bio,
        current_password: currentPassword,
      });
      await refreshUser();
      setEditing(false);
      setSuccess('Profile updated.');
      setTimeout(() => setSuccess(''), 4000);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) {
          setError('You can only edit your profile once per day.');
        } else if (err.status === 401) {
          setError('Incorrect password.');
        } else {
          setError(err.message);
        }
      } else {
        setError('Something went wrong.');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setError('');
    try {
      await api.uploadAvatar(file);
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed.');
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const editsLeft = user.profile_edits_today < 1 ? 1 : 0;
  const canEdit = editsLeft > 0 || user.profile_edit_date !== new Date().toISOString().slice(0, 10);

  return (
    <section className="section section-profile">
      <div className="profile-card">
        {/* Avatar */}
        <div className="profile-avatar-wrap">
          <div className="profile-avatar">
            {src ? (
              <img src={src} alt={user.username} className="profile-avatar__img" />
            ) : (
              <span className="profile-avatar__initial">{initial}</span>
            )}
          </div>
          <button
            type="button"
            className="profile-avatar-change"
            onClick={() => fileRef.current?.click()}
            disabled={avatarUploading}
            title="Change avatar"
          >
            {avatarUploading ? '…' : '📷'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => void handleAvatarChange(e)}
          />
        </div>

        {/* Header */}
        <div className="profile-header">
          <div>
            <h1 className="profile-name">{user.name || user.username}</h1>
            <p className="profile-username">@{user.username}</p>
            {user.city ? <p className="profile-city">{user.city}</p> : null}
          </div>
          {!editing ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={startEdit}
              disabled={!canEdit}
              title={!canEdit ? 'You can edit once per day' : undefined}
            >
              Edit profile
            </button>
          ) : null}
        </div>

        {success ? <p className="auth-success">{success}</p> : null}

        {/* View mode */}
        {!editing ? (
          <div className="profile-view">
            <div className="profile-view__row">
              <span className="profile-view__label">Email</span>
              <span className="profile-view__value">{user.email}</span>
            </div>
            {user.bio ? (
              <div className="profile-view__row">
                <span className="profile-view__label">Bio</span>
                <span className="profile-view__value">{user.bio}</span>
              </div>
            ) : null}
            {user.postal_code ? (
              <div className="profile-view__row">
                <span className="profile-view__label">Postal code</span>
                <span className="profile-view__value">{user.postal_code}</span>
              </div>
            ) : null}
            {user.interests.length > 0 ? (
              <div className="profile-view__row">
                <span className="profile-view__label">Interests</span>
                <div className="profile-tags">
                  {user.interests.map((i) => (
                    <span key={i} className="profile-tag">
                      {i}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}
            {!canEdit ? (
              <p className="profile-edit-limit muted small">
                Profile edits reset daily. Come back tomorrow to edit again.
              </p>
            ) : null}
          </div>
        ) : (
          /* Edit mode */
          <div className="profile-edit">
            <div className="auth-field">
              <label className="auth-label">Name</label>
              <input
                className="auth-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your full name"
                maxLength={120}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">City</label>
              <CitySelect value={city} onChange={setCity} />
            </div>

            <div className="auth-field">
              <label className="auth-label">Postal code</label>
              <input
                className="auth-input"
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="400001"
                maxLength={20}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Bio</label>
              <textarea
                className="auth-input auth-textarea"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the community about yourself…"
                maxLength={600}
                rows={3}
              />
            </div>

            <div className="auth-field">
              <label className="auth-label">Interests</label>
              <div className="profile-interest-grid">
                {INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    type="button"
                    className={`profile-interest-btn${interests.includes(interest) ? ' is-selected' : ''}`}
                    onClick={() => toggleInterest(interest)}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label">Current password (required to save)</label>
              <input
                className="auth-input"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>

            {error ? <p className="auth-error">{error}</p> : null}

            <div className="profile-edit-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleSave()}
                disabled={saving}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancelEdit} disabled={saving}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
