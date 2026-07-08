import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CC_CITIES, useCity } from '../context/CityContext';
import { CityDropdown } from '../components/ui/CityDropdown';
import { ccApi, type Venue, type Category, type VenueListing } from '../lib/ccApi';
import { useActivity } from '../hooks/useActivity';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

function imgSrc(url: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE}${url}`;
}

const SPORT_COVER_IMAGES: Record<string, string> = {
  badminton: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&q=80',
  cricket: 'https://images.unsplash.com/photo-1540747913346-19378ce70f40?w=800&q=80',
  football: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
  basketball: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=800&q=80',
  table_tennis: 'https://images.unsplash.com/photo-1611251126112-57a40c165930?w=800&q=80',
  tennis: 'https://images.unsplash.com/photo-1595435742656-5272d0b3fa82?w=800&q=80',
  volleyball: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=800&q=80',
  swimming: 'https://images.unsplash.com/photo-1600965962102-9d260a71890d?w=800&q=80',
  valorant: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80',
  bgmi: 'https://images.unsplash.com/photo-1592478411213-6153e4ebc696?w=800&q=80',
  pubg: 'https://images.unsplash.com/photo-1592478411213-6153e4ebc696?w=800&q=80',
  chess: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=800&q=80',
  kabaddi: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
  boxing: 'https://images.unsplash.com/photo-1549719386-74dfcbf7dbed?w=800&q=80',
  playstation: 'https://images.unsplash.com/photo-1592478411213-6153e4ebc696?w=800&q=80',
  pc_gaming: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&q=80',
  default: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80',
};

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
  const { cities, toggleCity, matchesCity } = useCity();
  const navigate = useNavigate();
  const { track } = useActivity();

  const [venues, setVenues] = useState<Venue[]>([]);
  const [venueListings, setVenueListings] = useState<Record<number, VenueListing[]>>({});
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  const [error, setError] = useState('');

  // Auto-set city from user profile ONLY on first page load if:
  // 1. No city is currently saved in localStorage (cities === [])
  // 2. User has a city set on their profile
  // 3. We haven't done this before this session
  // Using sessionStorage to ensure it only happens once per browser session.
  useEffect(() => {
    if (!user?.city) return;
    const alreadyDone = sessionStorage.getItem('cc_city_auto_set');
    if (alreadyDone) return;
    if (cities.length > 0) {
      // Cities already chosen (from localStorage), mark done and stop
      sessionStorage.setItem('cc_city_auto_set', '1');
      return;
    }
    const match = CC_CITIES.find((c) => c.toLowerCase() === user.city.trim().toLowerCase());
    if (match) {
      sessionStorage.setItem('cc_city_auto_set', '1');
      toggleCity(match);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([ccApi.venues(), ccApi.categories()])
      .then(([vs, cs]) => {
        setVenues(vs);
        setCategories(cs);
        // Task 10.3 — fetch listings for all venues in parallel
        Promise.allSettled(vs.map((v) => ccApi.venueListings(v.id))).then((results) => {
          const map: Record<number, VenueListing[]> = {};
          results.forEach((result, idx) => {
            if (result.status === 'fulfilled') {
              map[vs[idx].id] = result.value;
            }
          });
          setVenueListings(map);
        });
      })
      .catch(() => setError('Could not load venues.'))
      .finally(() => setLoading(false));
  }, []);

  // Only show physical + esports categories as sport filters
  const sportCats = categories.filter((c) => c.type === 'physical' || c.type === 'esports');

  // Filter venues by city
  const cityFiltered = venues.filter((v) => matchesCity(v.city));

  // Task 10.3 — filter by sport using fetched listings
  const list =
    selectedSport !== 'all'
      ? cityFiltered.filter((v) =>
          venueListings[v.id]?.some(
            (l) => l.category.slug === selectedSport && l.is_active,
          ),
        )
      : cityFiltered;

  return (
    <section className="section section-turf">
      <div className="section-inner">
        {/* Task 10.2 — CityDropdown replaces CityBar */}
        <CityDropdown />

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
              onClick={() => {
                setSelectedSport(c.slug);
                track({ event: 'sport_filter', sport: c.slug, city: cities[0] ?? '' });
              }}
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
                listings={venueListings[v.id] ?? []}
                onSelect={() => {
                  track({
                    event: 'venue_card_click',
                    venue_id: v.id,
                    venue_name: v.name,
                    sport: selectedSport !== 'all' ? selectedSport : '',
                    city: v.city,
                  });
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

// Task 10.4 — VenueCard with listing preview
function VenueCard({ venue: v, selectedSport, listings, onSelect }: {
  venue: Venue; selectedSport: string; listings: VenueListing[]; onSelect: () => void;
}) {
  // Use first cover_photo if available, then fall back to cover_url, then sport image
  const coverPhotos = v.cover_photos ?? [];
  const src = coverPhotos.length > 0
    ? coverPhotos[0].url
    : v.cover_url
    ? imgSrc(v.cover_url)
    : selectedSport !== 'all'
    ? SPORT_COVER_IMAGES[selectedSport] ?? SPORT_COVER_IMAGES.default
    : null;

  const matchingListings =
    selectedSport !== 'all'
      ? listings.filter((l) => l.category.slug === selectedSport && l.is_active)
      : [];

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
            {/* Task 10.4 — listing preview subtitle */}
            {matchingListings.length >= 1 ? (
              <p className="venue-card-v2__listing-preview">
                {matchingListings[0].title}
                {matchingListings.length > 1 ? (
                  <span className="venue-card-v2__listing-more"> + {matchingListings.length - 1} more</span>
                ) : null}
              </p>
            ) : null}
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
            {selectedSport !== 'all'
              ? `View ${selectedSport.charAt(0).toUpperCase() + selectedSport.slice(1).replace(/_/g, ' ')} →`
              : 'View listings →'}
          </button>
        </div>
      </div>
    </div>
  );
}
