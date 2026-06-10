import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ccApi, type Venue, type VenueListing } from '../lib/ccApi';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

function imgSrc(url: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE}${url}`;
}

function priceLabel(listing: VenueListing) {
  if (listing.price_per_session > 0) return `₹${listing.price_per_session / 100} / session`;
  if (listing.price_per_hour > 0) return `₹${listing.price_per_hour / 100} / hr`;
  return 'Free';
}

export function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [listings, setListings] = useState<VenueListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [photoIdx, setPhotoIdx] = useState<Record<number, number>>({});

  useEffect(() => {
    if (!id) return;
    Promise.all([
      ccApi.venue(Number(id)),
      ccApi.venueListings(Number(id)),
    ]).then(([v, ls]) => {
      setVenue(v);
      setListings(ls);
    }).finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <section className="section section-venue-detail">
        <div className="section-inner">
          <div className="venue-detail-skeleton" />
        </div>
      </section>
    );
  }

  if (!venue) {
    return (
      <section className="section section-venue-detail">
        <div className="section-inner">
          <p className="auth-error">Venue not found.</p>
          <Link to="/turf" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>← Back to venues</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section section-venue-detail">
      <div className="section-inner">
        {/* Back */}
        <Link to="/turf" className="venue-detail__back">← All venues</Link>

        {/* Cover */}
        {venue.cover_url ? (
          <div className="venue-detail__cover">
            <img src={imgSrc(venue.cover_url)} alt={venue.name} />
          </div>
        ) : null}

        {/* Header */}
        <div className="venue-detail__header">
          {venue.logo_url ? (
            <img src={imgSrc(venue.logo_url)} alt="" className="venue-detail__logo" />
          ) : null}
          <div>
            <div className="venue-detail__name-row">
              <h1 className="venue-detail__name">{venue.name}</h1>
              {venue.is_verified && <span className="venue-verified-badge">✓ Verified</span>}
            </div>
            <p className="venue-detail__location">
              {[venue.address_line1, venue.city, venue.state].filter(Boolean).join(', ')}
            </p>
            {venue.phone && (
              <a href={`tel:${venue.phone}`} className="venue-detail__phone">{venue.phone}</a>
            )}
          </div>
        </div>

        {venue.description ? (
          <p className="venue-detail__desc">{venue.description}</p>
        ) : null}

        {/* Listings */}
        <div className="venue-detail__listings-head">
          <h2>What's available</h2>
          <p className="muted small">{listings.length} listing{listings.length !== 1 ? 's' : ''}</p>
        </div>

        {listings.length === 0 ? (
          <p className="muted">No listings yet for this venue.</p>
        ) : (
          <div className="listing-grid">
            {listings.map((l) => {
              const idx = photoIdx[l.id] ?? 0;
              const photo = l.photos[idx];
              return (
                <div key={l.id} className="listing-card">
                  {/* Photo carousel */}
                  <div className="listing-card__photos">
                    {l.photos.length > 0 ? (
                      <>
                        <img
                          src={imgSrc(photo?.url ?? '')}
                          alt={l.title}
                          className="listing-card__photo"
                        />
                        {l.photos.length > 1 && (
                          <div className="listing-card__photo-dots">
                            {l.photos.map((_, i) => (
                              <button
                                key={i}
                                type="button"
                                className={`photo-dot${i === idx ? ' photo-dot--active' : ''}`}
                                onClick={() => setPhotoIdx((prev) => ({ ...prev, [l.id]: i }))}
                                aria-label={`Photo ${i + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="listing-card__photo-placeholder">
                        {l.category.type === 'esports' ? '🎮' : '⚽'}
                      </div>
                    )}
                    <span className={`listing-card__type listing-card__type--${l.category.type}`}>
                      {l.category.name}
                    </span>
                  </div>

                  <div className="listing-card__body">
                    <h3 className="listing-card__title">{l.title}</h3>
                    {l.description ? (
                      <p className="listing-card__desc">{l.description}</p>
                    ) : null}

                    <div className="listing-card__details">
                      {l.capacity > 0 && (
                        <span className="listing-card__detail">👥 {l.capacity} max</span>
                      )}
                      {l.duration_minutes > 0 && (
                        <span className="listing-card__detail">⏱ {l.duration_minutes} min</span>
                      )}
                    </div>

                    {l.amenities.length > 0 && (
                      <div className="listing-card__amenities">
                        {l.amenities.map((a) => (
                          <span key={a} className="listing-card__amenity">{a}</span>
                        ))}
                      </div>
                    )}

                    <div className="listing-card__footer">
                      <span className="listing-card__price">{priceLabel(l)}</span>
                      {l.is_bookable ? (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => {
                            if (!user) navigate(`/login?next=${encodeURIComponent(`/venue/${venue.id}`)}`);
                            else navigate(`/book/${l.id}`);
                          }}
                        >
                          Book now
                        </button>
                      ) : (
                        <span className="listing-card__not-bookable muted small">Walk-in only</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
