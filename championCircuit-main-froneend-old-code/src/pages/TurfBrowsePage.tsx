import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import { CityBar } from '../components/ui/CityBar';
import { ccApi, type Venue, type Category } from '../lib/ccApi';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

function imgSrc(url: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE}${url}`;
}

const SPORT_ICONS: Record<string, string> = {
  cricket: '🏏', football: '⚽', badminton: '🏸', basketball: '🏀',
  table_tennis: '🏓', kabaddi: '🤼', tennis: '🎾', volleyball: '🏐',
  swimming: '🏊', boxing: '🥊',
  valorant: '🎯', bgmi: '🔫', pubg: '🔫', free_fire: '🔥',
  fifa: '⚽', cod: '💥', playstation: '🎮', pc_gaming: '💻',
  chess: '♟', carrom: '🎯',
  food_beverages: '🍔', merchandise: '👕', coaching: '📚', fitness: '💪',
};

export function TurfBrowsePage() {
  const { user } = useAuth();
  const { cities, matchesCity } = useCity();
  const navigate = useNavigate();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([ccApi.venues(), ccApi.categories()])
      .then(([vs, cs]) => { setVenues(vs); setCategories(cs); })
      .catch(() => setError('Could not load venues.'))
      .finally(() => setLoading(false));
  }, []);

  // Only show physical + esports categories as sport filters
  const sportCats = categories.filter((c) => c.type === 'physical' || c.type === 'esports');

  // Filter venues by city
  const cityFiltered = venues.filter((v) => matchesCity(v.city));

  // Filter by sport — show venues that have a listing with this category
  // (we don't have full listing data here, so we filter client-side via venue listings)
  const list = cityFiltered; // sport filter is shown below listings

  return (
    <section className="section section-turf">
      <div className="section-inner">
        {/* City bar */}
        <CityBar />

        {/* Sport filter */}
        <div className="sport-filter-row">
          <button
            type="button"
            className={`sport-chip${selectedSport === 'all' ? ' sport-chip--active' : ''}`}
            onClick={() => setSelectedSport('all')}
          >
            <span className="sport-chip__icon">🏆</span>
            <span>All sports</span>
          </button>
          {sportCats.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={`sport-chip sport-chip--${c.type}${selectedSport === c.slug ? ' sport-chip--active' : ''}`}
              onClick={() => setSelectedSport(c.slug)}
            >
              <span className="sport-chip__icon">{SPORT_ICONS[c.slug] ?? '🎮'}</span>
              <span>{c.name}</span>
            </button>
          ))}
        </div>

        <div className="section-head" style={{ marginTop: 20 }}>
          <h1>Book a turf</h1>
          <p>
            {cities.length > 0 ? `Venues in ${cities.join(', ')}` : 'All venues'}
            {selectedSport !== 'all' ? ` · ${sportCats.find((c) => c.slug === selectedSport)?.name ?? selectedSport}` : ''}.
            {' '}Click a venue to see available slots.
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
            <p className="venue-empty__title">No venues yet</p>
            <p className="venue-empty__sub">We're onboarding venues — check back soon.</p>
          </div>
        ) : (
          <div className="venue-grid">
            {list.map((v) => (
              <VenueCard
                key={v.id}
                venue={v}
                selectedSport={selectedSport}
                onSelect={() => {
                  if (!user) navigate(`/login?next=${encodeURIComponent(`/venue/${v.id}${selectedSport !== 'all' ? `?sport=${selectedSport}` : ''}`)}`);
                  else navigate(`/venue/${v.id}${selectedSport !== 'all' ? `?sport=${selectedSport}` : ''}`);
                }}
              />
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

function VenueCard({ venue: v, selectedSport, onSelect }: {
  venue: Venue; selectedSport: string; onSelect: () => void;
}) {
  const src = imgSrc(v.cover_url);
  return (
    <div className="venue-card-v2" onClick={onSelect} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onSelect()}>
      <div className="venue-card-v2__cover">
        {src ? (
          <img src={src} alt={v.name} className="venue-card-v2__cover-img" />
        ) : (
          <div className="venue-card-v2__cover-placeholder">🏟</div>
        )}
        {v.is_verified && <span className="venue-card-v2__verified">✓ Verified</span>}
        {selectedSport !== 'all' && (
          <span className="venue-card-v2__sport-badge">{selectedSport}</span>
        )}
      </div>

      <div className="venue-card-v2__body">
        <div className="venue-card-v2__header">
          {v.logo_url ? (
            <img src={imgSrc(v.logo_url)} alt="" className="venue-card-v2__logo" />
          ) : null}
          <div className="venue-card-v2__info">
            <h3 className="venue-card-v2__name">{v.name}</h3>
            <p className="venue-card-v2__location">📍 {v.city}{v.state ? `, ${v.state}` : ''}</p>
          </div>
        </div>

        {v.description ? (
          <p className="venue-card-v2__desc">{v.description}</p>
        ) : null}

        <div className="venue-card-v2__footer">
          <div className="venue-card-v2__actions">
            {v.phone && (
              <a href={`tel:${v.phone}`} className="venue-card-v2__action-btn"
                onClick={(e) => e.stopPropagation()} title="Call venue">
                📞
              </a>
            )}
            {v.lat && v.lng ? (
              <a
                href={`https://www.google.com/maps?q=${v.lat},${v.lng}`}
                target="_blank" rel="noopener noreferrer"
                className="venue-card-v2__action-btn"
                onClick={(e) => e.stopPropagation()} title="View on Google Maps"
              >
                🗺
              </a>
            ) : v.address_line1 ? (
              <a
                href={`https://www.google.com/maps/search/${encodeURIComponent(v.name + ' ' + v.city)}`}
                target="_blank" rel="noopener noreferrer"
                className="venue-card-v2__action-btn"
                onClick={(e) => e.stopPropagation()} title="Find on Google Maps"
              >
                🗺
              </a>
            ) : null}
          </div>
          <button type="button" className="btn btn-primary btn-sm">
            View listings →
          </button>
        </div>
      </div>
    </div>
  );
}
