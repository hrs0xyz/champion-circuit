import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import { CityBar } from '../components/ui/CityBar';
import { ccApi, type Venue } from '../lib/ccApi';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

function imgSrc(url: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE}${url}`;
}

export function TurfBrowsePage() {
  const { user } = useAuth();
  const { cities, matchesCity } = useCity();
  const navigate = useNavigate();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    ccApi.venues()
      .then(setVenues)
      .catch(() => setError('Could not load venues.'))
      .finally(() => setLoading(false));
  }, []);

  const list = venues.filter((v) => matchesCity(v.city));

  return (
    <section className="section section-turf">
      <div className="section-inner">
        <CityBar />

        <div className="section-head" style={{ marginTop: 24 }}>
          <h1>Book a turf</h1>
          <p>
            {cities.length > 0 ? `Venues in ${cities.join(', ')}.` : 'Browse all venues.'}
            {' '}Pick a venue to see listings and available slots.
          </p>
        </div>

        {loading ? (
          <div className="venue-grid-loading">
            {[1, 2, 3].map((i) => <div key={i} className="venue-card-skeleton" />)}
          </div>
        ) : error ? (
          <p className="auth-error">{error}</p>
        ) : list.length === 0 ? (
          <div className="venue-empty">
            <p className="venue-empty__icon">🏟</p>
            <p className="venue-empty__title">
              {cities.length > 0 ? `No venues in ${cities.join(' / ')} yet` : 'No venues yet'}
            </p>
            <p className="venue-empty__sub">We're onboarding venues — check back soon.</p>
          </div>
        ) : (
          <div className="venue-grid">
            {list.map((v) => (
              <div
                key={v.id}
                className="venue-card-new"
                onClick={() => {
                  if (!user) navigate(`/login?next=${encodeURIComponent(`/venue/${v.id}`)}`);
                  else navigate(`/venue/${v.id}`);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate(`/venue/${v.id}`)}
              >
                <div className="venue-card-new__cover">
                  {v.cover_url ? (
                    <img src={imgSrc(v.cover_url)} alt={v.name} className="venue-card-new__cover-img" />
                  ) : (
                    <div className="venue-card-new__cover-placeholder">🏟</div>
                  )}
                  {v.is_verified && (
                    <span className="venue-card-new__verified" title="Verified venue">✓ Verified</span>
                  )}
                </div>
                <div className="venue-card-new__body">
                  <div className="venue-card-new__meta">
                    {v.logo_url ? (
                      <img src={imgSrc(v.logo_url)} alt="" className="venue-card-new__logo" />
                    ) : null}
                    <div>
                      <h3 className="venue-card-new__name">{v.name}</h3>
                      <p className="venue-card-new__city">{v.city}{v.state ? `, ${v.state}` : ''}</p>
                    </div>
                  </div>
                  {v.description ? (
                    <p className="venue-card-new__desc">{v.description}</p>
                  ) : null}
                  <div className="venue-card-new__footer">
                    <button type="button" className="btn btn-primary btn-sm">
                      View listings →
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!user ? (
          <p className="auth-inline muted small" style={{ marginTop: 32 }}>
            <Link className="auth-inline__link" to="/login">Sign in</Link>
            <span className="auth-inline__text"> to book slots, or </span>
            <Link className="auth-inline__link" to="/signup">create an account</Link>
            <span className="auth-inline__text">.</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
