import { Pencil } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ProfileForm } from '../components/ProfileForm';
import { useAuth } from '../context/AuthContext';

export function ProfilePage() {
  const { user, updateProfile, uploadAvatar } = useAuth();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  if (!user) return null;

  const canEditToday = user.profile_edit_date !== new Date().toISOString().slice(0, 10) || user.profile_edits_today < 1;

  return (
    <main className="profile-page">
      <section className="profile-hero">
        <div className="avatar-preview">
          {user.avatar_url ? <img src={user.avatar_url} alt="" /> : (user.name || user.username).slice(0, 2).toUpperCase()}
        </div>
        <div>
          <p className="eyebrow">Your circuit profile</p>
          <h1>{user.name || `@${user.username}`}</h1>
          <p className="muted">
            @{user.username} • {user.city || 'City not added'} • {user.email}
          </p>
        </div>
      </section>

      {!editing ? (
        <section className="auth-panel profile-view">
          <div className="profile-view-grid">
            <div>
              <span>Name</span>
              <strong>{user.name || 'Not added'}</strong>
            </div>
            <div>
              <span>City</span>
              <strong>{user.city || 'Not added'}</strong>
            </div>
            <div>
              <span>Postal code</span>
              <strong>{user.postal_code || 'Not added'}</strong>
            </div>
            <div>
              <span>Interests</span>
              <strong>{user.interests.length ? user.interests.join(', ') : 'Not added'}</strong>
            </div>
          </div>
          {user.bio ? <p className="profile-bio">{user.bio}</p> : <p className="muted">No bio yet.</p>}
          {error ? <p className="form-error">{error}</p> : null}
          <button
            className="primary-action"
            type="button"
            disabled={!canEditToday}
            onClick={() => {
              setError('');
              if (!canEditToday) {
                setError('You can edit your profile once per day.');
                return;
              }
              setEditing(true);
            }}
          >
            <Pencil size={18} />
            Edit profile
          </button>
          {!canEditToday ? <p className="muted">Profile edit used today. Come back tomorrow.</p> : null}
        </section>
      ) : (
        <section className="auth-panel">
          <ProfileForm
            mode="profile"
            initial={user}
            onUploadAvatar={uploadAvatar}
            onSubmit={async (payload) => {
              await updateProfile({ ...payload, current_password: payload.current_password ?? '' });
              navigate('/');
            }}
          />
          <button className="secondary-action profile-cancel" type="button" onClick={() => setEditing(false)}>
            Cancel
          </button>
        </section>
      )}
    </main>
  );
}

