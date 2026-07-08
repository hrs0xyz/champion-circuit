import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ccApi, type Category, type Review, type Venue, type VenueListing, ApiError } from '../lib/ccApi';
import { InquiryModal } from '../components/ui/InquiryModal';
import { useActivity } from '../hooks/useActivity';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

// Google Places-style sport images as fallbacks
const SPORT_COVER_IMAGES: Record<string, string> = {
  badminton: 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=1200&q=80',
  cricket: 'https://images.unsplash.com/photo-1540747913346-19378ce70f40?w=1200&q=80',
  football: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=1200&q=80',
  basketball: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?w=1200&q=80',
  table_tennis: 'https://images.unsplash.com/photo-1611251126112-57a40c165930?w=1200&q=80',
  tennis: 'https://images.unsplash.com/photo-1595435742656-5272d0b3fa82?w=1200&q=80',
  volleyball: 'https://images.unsplash.com/photo-1612872087720-bb876e2e67d1?w=1200&q=80',
  swimming: 'https://images.unsplash.com/photo-1600965962102-9d260a71890d?w=1200&q=80',
  valorant: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=1200&q=80',
  bgmi: 'https://images.unsplash.com/photo-1592478411213-6153e4ebc696?w=1200&q=80',
  pubg: 'https://images.unsplash.com/photo-1592478411213-6153e4ebc696?w=1200&q=80',
  chess: 'https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=1200&q=80',
  default: 'https://images.unsplash.com/photo-1485395037613-e83d5c1f5290?w=1200&q=80',
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

function imgSrc(url: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE}${url}`;
}

function priceLabel(listing: VenueListing) {
  if (listing.price_per_session > 0) return `₹${listing.price_per_session / 100} / session`;
  if (listing.price_per_hour > 0) return `₹${listing.price_per_hour / 100} / hr`;
  return 'Free';
}

// ── Listing Detail Modal ──────────────────────────────────────────────────────
// Currently unused (inline listing cards replaced the modal) — kept for reuse.

export function ListingDetailModal({
  listing: l,
  venueName,
  venuePhone,
  onClose,
  onInquiry,
  user: _user,
}: {
  listing: VenueListing;
  venueName: string;
  venuePhone: string;
  onClose: () => void;
  onInquiry: () => void;
  user: { name?: string } | null;
}) {
  const sportPhoto = SPORT_COVER_IMAGES[l.category.slug] ?? SPORT_COVER_IMAGES.default;
  const displayPhoto = l.photos.length > 0 ? imgSrc(l.photos[0].url) : sportPhoto;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div
      className="listing-modal-backdrop"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="listing-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button type="button" className="listing-modal__close" onClick={onClose} aria-label="Close">✕</button>

        {/* Photo */}
        <div className="listing-modal__photo">
          <img src={displayPhoto} alt={l.title} />
          <span className={`listing-card__type listing-card__type--${l.category.type}`}>
            {l.category.name}
          </span>
        </div>

        {/* Content */}
        <div className="listing-modal__body">
          <h2 className="listing-modal__title">{l.title}</h2>
          <p className="listing-modal__venue muted small">📍 {venueName}</p>

          <div className="listing-modal__meta">
            {l.capacity && <span className="listing-card__detail">👥 {l.capacity} players</span>}
            {l.duration_minutes > 0 && <span className="listing-card__detail">⏱ {l.duration_minutes} min</span>}
            <span className="listing-modal__price">{priceLabel(l)}</span>
          </div>

          {l.description && <p className="listing-modal__desc">{l.description}</p>}

          {l.amenities.length > 0 && (
            <div className="listing-modal__amenities-section">
              <p className="listing-expanded-label">Amenities</p>
              <div className="listing-card__amenities">
                {l.amenities.map((a) => (
                  <span key={a} className="listing-card__amenity">{a}</span>
                ))}
              </div>
            </div>
          )}

          {l.rules && (
            <div className="listing-modal__section">
              <p className="listing-expanded-label">Rules</p>
              <p className="listing-modal__desc">{l.rules}</p>
            </div>
          )}

          <div className="listing-modal__section">
            <p className="listing-expanded-label">How to book</p>
            <p className="listing-modal__desc">
              Send an inquiry — we'll confirm availability and share booking details with you directly.
            </p>
          </div>

          {/* Actions */}
          <div className="listing-modal__actions">
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1 }}
              onClick={onInquiry}
            >
              📩 Send Inquiry
            </button>
            {venuePhone && (
              <a href={`tel:${venuePhone}`} className="btn btn-secondary">
                📞 Call
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Photo Gallery (Google Maps style) ────────────────────────────────────────

function VenuePhotoGallery({
  venue,
  listings,
  sportParam,
}: {
  venue: Venue;
  listings: VenueListing[];
  sportParam: string;
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [thumbRotateIdx, setThumbRotateIdx] = useState(0);

  // Build photo list: cover_photos first, then listing photos filtered by sport
  const photos: { src: string; alt: string }[] = [];

  const coverPhotos = venue.cover_photos ?? [];
  if (coverPhotos.length > 0) {
    coverPhotos.forEach((p) => photos.push({ src: p.url, alt: venue.name }));
  } else if (venue.cover_url) {
    photos.push({ src: imgSrc(venue.cover_url), alt: venue.name });
  }

  // Add listing photos — when sport filter active, only that sport's photos
  const seen = new Set<string>(photos.map((p) => p.src));
  const relevantListings = sportParam
    ? listings.filter((l) => l.category.slug === sportParam)
    : listings;
  relevantListings.forEach((l) => {
    l.photos.forEach((p) => {
      const src = imgSrc(p.url);
      if (!seen.has(src)) {
        seen.add(src);
        photos.push({ src, alt: l.title });
      }
    });
  });

  // Only use sport fallback if there are ZERO real photos at all
  if (photos.length === 0) {
    // no real photos uploaded — show nothing (gallery won't render)
  }

  const mainPhoto = photos[0];
  // Extra photos beyond the first 4 thumbs rotate in the last thumb slot
  const staticThumbs = photos.slice(1, 4);         // positions 1-3 fixed
  const rotatingPool = photos.slice(4);             // position 4+ rotate

  // Auto-rotate only the last thumb slot every 3s if there are extra photos
  useEffect(() => {
    if (rotatingPool.length === 0) return;
    setThumbRotateIdx(0); // reset when pool changes (sport filter change)
    const t = setInterval(() => setThumbRotateIdx((i) => (i + 1) % rotatingPool.length), 3000);
    return () => clearInterval(t);
  }, [rotatingPool.length, sportParam]);

  // Build 4 thumb slots
  const thumbSlots: { src: string; alt: string; photoIdx: number }[] = staticThumbs.map((p, i) => ({
    ...p, photoIdx: i + 1,
  }));
  if (rotatingPool.length > 0) {
    thumbSlots.push({
      src: rotatingPool[thumbRotateIdx].src,
      alt: rotatingPool[thumbRotateIdx].alt,
      photoIdx: 4 + thumbRotateIdx,
    });
  }

  const totalCount = photos.length;

  // Don't render gallery if no real photos
  if (photos.length === 0) return null;

  return (
    <>
      <div className="vdp-gallery">
        {/* Main large image — fixed, no auto-rotate */}
        <button
          className="vdp-gallery__main"
          type="button"
          onClick={() => setLightboxIdx(0)}
          aria-label="View photo"
        >
          <img src={mainPhoto.src} alt={mainPhoto.alt} loading="eager" />
        </button>

        {/* Thumbnail grid — only shows if there are real thumb photos */}
        {thumbSlots.length > 0 && (
          <div
            className="vdp-gallery__thumbs"
            data-count={thumbSlots.length}
          >
            {thumbSlots.map((p, i) => (
              <button
                key={i}
                className="vdp-gallery__thumb"
                type="button"
                style={thumbSlots.length === 3 && i === 2 ? { gridColumn: '1 / -1' } : undefined}
                onClick={() => setLightboxIdx(p.photoIdx)}
                aria-label={`View photo ${p.photoIdx + 1}`}
              >
                <img src={p.src} alt={p.alt} loading="lazy" />
                {i === thumbSlots.length - 1 && totalCount > 5 && (
                  <div className="vdp-gallery__more-overlay">+{totalCount - 5} more</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {lightboxIdx !== null && (
        <PhotoLightbox photos={photos} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
      )}
    </>
  );
}

function PhotoLightbox({
  photos,
  startIdx,
  onClose,
}: {
  photos: { src: string; alt: string }[];
  startIdx: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(startIdx);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIdx((i) => (i + 1) % photos.length);
      if (e.key === 'ArrowLeft') setIdx((i) => (i - 1 + photos.length) % photos.length);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [photos.length, onClose]);

  return (
    <div className="vdp-lightbox" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="vdp-lightbox__inner" onClick={(e) => e.stopPropagation()}>
        <button className="vdp-lightbox__close" onClick={onClose} aria-label="Close">✕</button>
        <button
          className="vdp-lightbox__prev"
          onClick={() => setIdx((i) => (i - 1 + photos.length) % photos.length)}
          aria-label="Previous photo"
          disabled={photos.length <= 1}
        >‹</button>
        <img src={photos[idx].src} alt={photos[idx].alt} className="vdp-lightbox__img" />
        <button
          className="vdp-lightbox__next"
          onClick={() => setIdx((i) => (i + 1) % photos.length)}
          aria-label="Next photo"
          disabled={photos.length <= 1}
        >›</button>
        <div className="vdp-lightbox__counter">{idx + 1} / {photos.length}</div>
      </div>
    </div>
  );
}

// ── ListingFilterBar ──────────────────────────────────────────────────────────

interface ListingFilterBarProps {
  categories: Category[];
  selected: string;
  onSelect: (slug: string) => void;
}

function ListingFilterBar({ categories, selected, onSelect }: ListingFilterBarProps) {
  return (
    <div className="listing-filter-bar">
      <button
        type="button"
        className={'listing-filter-bar__chip' + (selected === 'all' ? ' listing-filter-bar__chip--active' : '')}
        onClick={() => onSelect('all')}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c.slug}
          type="button"
          className={'listing-filter-bar__chip' + (selected === c.slug ? ' listing-filter-bar__chip--active' : '')}
          onClick={() => onSelect(c.slug)}
        >
          {SPORT_ICONS[c.slug] ?? '🎮'} {c.name}
        </button>
      ))}
    </div>
  );
}

// ── ReviewsSection ────────────────────────────────────────────────────────────

export function ReviewsSection({ venueId }: { venueId: number }) {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [loadError, setLoadError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');

  useEffect(() => {
    ccApi.venueReviews(venueId).then(setReviews).catch(() => setLoadError('Could not load reviews'));
  }, [venueId]);

  const avgRating =
    reviews.length > 0
      ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
      : '0.0';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1) {
      setSubmitError('Please select a rating.');
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const newReview = await ccApi.submitReview({ venue_id: venueId, rating, comment });
      setReviews((prev) => [newReview, ...prev]);
      setRating(0);
      setComment('');
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setSubmitError('You have already reviewed this venue.');
      } else {
        setSubmitError('Could not submit review. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="vdp-reviews">
      <div className="vdp-reviews__header">
        <h2 className="vdp-reviews__title">
          <span className="vdp-reviews__star">★</span>
          {avgRating}
          <span className="vdp-reviews__count"> · {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}</span>
        </h2>
      </div>

      {loadError && <p className="vdp-error">{loadError}</p>}

      {!loadError && reviews.length === 0 && (
        <p className="vdp-reviews__empty">No reviews yet — be the first!</p>
      )}

      <div className="vdp-reviews__list">
        {reviews.map((review) => {
          const date = new Date(review.created_at).toLocaleDateString('en-IN', {
            month: 'short',
            year: 'numeric',
          });
          return (
            <div key={review.id} className="vdp-review-card">
              <div className="vdp-review-card__top">
                <div className="vdp-review-card__avatar">
                  {(review.username?.[0] ?? 'U').toUpperCase()}
                </div>
                <div>
                  <p className="vdp-review-card__name">{review.username}</p>
                  <p className="vdp-review-card__date">{date}</p>
                </div>
              </div>
              <div className="vdp-review-card__stars">
                {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
              </div>
              {review.comment && <p className="vdp-review-card__comment">{review.comment}</p>}
            </div>
          );
        })}
      </div>

      {user ? (
        <div className="vdp-reviews__write">
          <h3 className="vdp-reviews__write-title">Write a review</h3>
          <form onSubmit={handleSubmit} noValidate>
            <div className="vdp-star-picker" role="radiogroup" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-label={`${i} star${i > 1 ? 's' : ''}`}
                  aria-checked={rating === i}
                  className={`vdp-star-btn${rating >= i ? ' vdp-star-btn--filled' : ''}`}
                  onClick={() => setRating(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') setRating(Math.min(5, rating + 1));
                    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') setRating(Math.max(1, rating - 1));
                  }}
                >
                  {rating >= i ? '★' : '☆'}
                </button>
              ))}
            </div>

            <textarea
              className="vdp-reviews__textarea"
              rows={3}
              maxLength={500}
              placeholder="Share your experience (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />

            {submitError && <p className="vdp-error" role="alert">{submitError}</p>}

            <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Review'}
            </button>
          </form>
        </div>
      ) : (
        <p className="vdp-reviews__signin">
          <Link to="/login">Sign in</Link> to leave a review
        </p>
      )}
    </section>
  );
}

// ── ListingCard with auto-rotating photos ────────────────────────────────────

function ListingCard({ listing: l, venue, expandedListing, setExpandedListing, user, navigate, setShowInquiry, track }: {
  listing: VenueListing;
  venue: Venue;
  expandedListing: number | null;
  setExpandedListing: (id: number | null) => void;
  user: { name?: string } | null;
  navigate: (path: string) => void;
  setShowInquiry: (v: boolean) => void;
  track: (data: object) => void;
}) {
  const allPhotos = l.photos.length > 0
    ? l.photos.map((p) => imgSrc(p.url))
    : [SPORT_COVER_IMAGES[l.category.slug] ?? SPORT_COVER_IMAGES.default];

  const [idx, setIdx] = useState(0);

  // Auto-rotate every 3 seconds if multiple photos
  useEffect(() => {
    if (allPhotos.length <= 1) return;
    const timer = setInterval(() => {
      setIdx((i) => (i + 1) % allPhotos.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [allPhotos.length]);

  return (
    <div
      className="listing-card listing-card--clickable"
      role="button"
      tabIndex={0}
      onClick={() => {
        track({
          event: 'listing_inquiry',
          venue_id: venue.id,
          venue_name: venue.name,
          sport: l.category.slug,
          listing_id: l.id,
          listing_title: l.title,
        });
        setExpandedListing(expandedListing === l.id ? null : l.id);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setExpandedListing(expandedListing === l.id ? null : l.id);
        }
      }}
    >
      {/* Photo with auto-rotate */}
      <div className="listing-card__photos">
        <img
          src={allPhotos[idx]}
          alt={l.title}
          className="listing-card__photo"
          loading="lazy"
        />
        {allPhotos.length > 1 && (
          <div className="listing-card__photo-dots">
            {allPhotos.map((_, i) => (
              <button
                key={i}
                type="button"
                className={`photo-dot${i === idx ? ' photo-dot--active' : ''}`}
                onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                aria-label={`Photo ${i + 1}`}
              />
            ))}
          </div>
        )}
        <span className={`listing-card__type listing-card__type--${l.category.type}`}>
          {l.category.name}
        </span>
      </div>

      <div className="listing-card__body">
        <h3 className="listing-card__title">{l.title}</h3>
        {l.description && <p className="listing-card__desc">{l.description}</p>}
        <div className="listing-card__details">
          {l.capacity && <span className="listing-card__detail">👥 {l.capacity} players</span>}
          {l.duration_minutes > 0 && <span className="listing-card__detail">⏱ {l.duration_minutes} min</span>}
        </div>
        {l.amenities.length > 0 && (
          <div className="listing-card__amenities">
            {l.amenities.map((a) => <span key={a} className="listing-card__amenity">{a}</span>)}
          </div>
        )}
        <div className="listing-card__footer">
          <span className="listing-card__price">{priceLabel(l)}</span>
          <span className="listing-card__expand-hint muted small">
            {expandedListing === l.id ? '▲ Less' : '▼ More'}
          </span>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expandedListing === l.id && (
        <div className="listing-card__expanded" onClick={(e) => e.stopPropagation()}>
          <div className="listing-card__expanded-body">
            {/* Slots */}
            {l.slots && l.slots.filter((s) => !s.is_blocked).length > 0 && (
              <div className="listing-expanded-section">
                <p className="listing-expanded-label">Available Slots</p>
                <div className="listing-slots-grid">
                  {l.slots.filter((s) => !s.is_blocked).map((s) => (
                    <div key={s.id} className="listing-slot-chip">
                      <span className="listing-slot-chip__day">
                        {s.day_of_week >= 0 ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][s.day_of_week] : s.specific_date || 'Any'}
                      </span>
                      <span className="listing-slot-chip__time">{s.start_time} – {s.end_time}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {l.rules && (
              <div className="listing-expanded-section">
                <p className="listing-expanded-label">Rules</p>
                <p className="listing-expanded-text">{l.rules}</p>
              </div>
            )}
            {/* Send Inquiry — big prominent CTA */}
            <div className="listing-expanded-cta">
              <button
                type="button"
                className="btn btn-primary"
                style={{ flex: 1, fontSize: 16, padding: '12px 20px' }}
                onClick={() => {
                  if (!user) navigate(`/login?next=${encodeURIComponent(`/venue/${venue.id}`)}`);
                  else setShowInquiry(true);
                }}
              >
                📩 Send Inquiry
              </button>
              {venue.phone && (
                <a
                  href={`tel:${venue.phone}`}
                  className="btn btn-secondary"
                  onClick={(e) => e.stopPropagation()}
                >
                  📞 Call
                </a>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ whiteSpace: 'nowrap' }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/venue/${venue.id}?sport=${l.category.slug}`);
                }}
              >
                View →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── VenueDetailPage ───────────────────────────────────────────────────────────

export function VenueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sportParam = searchParams.get('sport') ?? '';
  const { track } = useActivity();

  const [venue, setVenue] = useState<Venue | null>(null);
  const [listings, setListings] = useState<VenueListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSlug, setFilterSlug] = useState(sportParam || 'all');
  const [showInquiry, setShowInquiry] = useState(false);
  const [expandedListing, setExpandedListing] = useState<number | null>(null);

  // Scroll to top and update filter when sport param changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setFilterSlug(sportParam || 'all');
    if (sportParam && listings.length > 0) {
      const first = listings.find((l) => l.category.slug === sportParam);
      setExpandedListing(first?.id ?? null);
    }
  }, [sportParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!id) return;
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    Promise.all([
      ccApi.venue(Number(id)),
      ccApi.venueListings(Number(id)),
    ]).then(([v, ls]) => {
      setVenue(v);
      const sorted = [...ls].sort((a, b) => {
        const am = a.category.slug === sportParam ? 0 : 1;
        const bm = b.category.slug === sportParam ? 0 : 1;
        return am - bm;
      });
      setListings(sorted);
      // Auto-expand first listing matching the sport param
      if (sportParam) {
        const firstMatch = sorted.find((l) => l.category.slug === sportParam);
        if (firstMatch) setExpandedListing(firstMatch.id);
      }
      // Track venue view
      track({
        event: 'venue_view',
        venue_id: v.id,
        venue_name: v.name,
        sport: sportParam || '',
        city: v.city,
      });
    }).finally(() => setLoading(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const filterCategories = [...new Map(listings.map((l) => [l.category.slug, l.category])).values()];
  const displayedListings = filterSlug === 'all'
    ? listings
    : listings.filter((l) => l.category.slug === filterSlug);

  // Google Maps embed
  let mapsEl: React.ReactNode = null;
  {
    let src = '';
    let href = '';
    if (venue.lat && venue.lng) {
      src = `https://maps.google.com/maps?q=${venue.lat},${venue.lng}&z=15&output=embed`;
      href = `https://www.google.com/maps?q=${venue.lat},${venue.lng}`;
    } else if (venue.address_line1 || venue.city || venue.name) {
      const query = encodeURIComponent(`${venue.name} ${venue.city}`.trim());
      src = `https://maps.google.com/maps?q=${query}&z=15&output=embed`;
      href = `https://www.google.com/maps/search/?api=1&query=${query}`;
    }
    if (src) {
      mapsEl = (
        <div className="vdp-map">
          <iframe
            title="Venue location map"
            src={src}
            loading="lazy"
            allowFullScreen
            referrerPolicy="no-referrer-when-downgrade"
            className="vdp-map__iframe"
          />
          <a href={href} target="_blank" rel="noopener noreferrer" className="vdp-map__link">
            Open in Google Maps ↗
          </a>
        </div>
      );
    }
  }

  return (
    <div className="vdp">
      {/* Photo Gallery — full width, immersive */}
      <VenuePhotoGallery venue={venue} listings={listings} sportParam={sportParam} />

      <div className="vdp__body">
        <div className="vdp__left">
          {/* Back */}
          <Link to="/turf" className="vdp__back">← All venues</Link>

          {/* Venue header */}
          <div className="vdp__header">
            <div className="vdp__header-main">
              {venue.logo_url && (
                <img src={imgSrc(venue.logo_url)} alt="" className="vdp__logo" />
              )}
              <div className="vdp__header-info">
                <div className="vdp__name-row">
                  <h1 className="vdp__name">{venue.name}</h1>
                  {venue.is_verified && <span className="venue-verified-badge">✓ Verified</span>}
                </div>
                <p className="vdp__location">
                  📍 {[venue.address_line1, venue.address_line2, venue.city, venue.state].filter(Boolean).join(', ')}
                </p>
                {venue.phone && (
                  <a href={`tel:${venue.phone}`} className="vdp__phone">📞 {venue.phone}</a>
                )}
                {venue.website && (
                  <a href={venue.website} target="_blank" rel="noreferrer" className="vdp__phone">🌐 {venue.website.replace(/^https?:\/\//, '')}</a>
                )}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                track({ event: 'listing_inquiry', venue_id: venue.id, venue_name: venue.name, sport: sportParam });
                setShowInquiry(true);
              }}
            >
              Send Inquiry
            </button>
          </div>

          {venue.description && (
            <p className="vdp__desc">{venue.description}</p>
          )}

          {/* Divider */}
          <div className="vdp__divider" />

          {/* Listings */}
          <div className="vdp__section-head">
            <h2>What's available</h2>
            <span className="muted small">{listings.length} listing{listings.length !== 1 ? 's' : ''}</span>
          </div>

          {listings.length === 0 ? (
            <p className="muted">No listings yet for this venue.</p>
          ) : (
            <>
              <ListingFilterBar
                categories={filterCategories}
                selected={filterSlug}
                onSelect={(slug) => {
                  setFilterSlug(slug);
                  // Auto-expand first listing of the newly selected sport
                  if (slug !== 'all') {
                    const first = listings.find((l) => l.category.slug === slug);
                    if (first) setExpandedListing(first.id);
                  } else {
                    setExpandedListing(null);
                  }
                }}
              />

              <div className="listing-grid">
                {displayedListings.map((l) => (
                  <ListingCard
                    key={l.id}
                    listing={l}
                    venue={venue}
                    expandedListing={expandedListing}
                    setExpandedListing={setExpandedListing}
                    user={user}
                    navigate={navigate}
                    setShowInquiry={setShowInquiry}
                    track={track}
                  />
                ))}
              </div>
            </>
          )}

          <div className="vdp__divider" />

          {/* Reviews */}
          <ReviewsSection venueId={venue.id} />
        </div>

        {/* Right sidebar: map + quick info */}
        <aside className="vdp__sidebar">
          <div className="vdp__sidebar-card">
            <h3 className="vdp__sidebar-title">Location</h3>
            {mapsEl ?? (
              <p className="muted small">No location data available.</p>
            )}
            {venue.address_line1 && (
              <p className="vdp__sidebar-address">
                {[venue.address_line1, venue.address_line2, venue.city, venue.state].filter(Boolean).join(', ')}
              </p>
            )}
          </div>

          {(venue.phone || venue.website) && (
            <div className="vdp__sidebar-card">
              <h3 className="vdp__sidebar-title">Contact</h3>
              {venue.phone && (
                <a href={`tel:${venue.phone}`} className="vdp__sidebar-phone">
                  📞 {venue.phone}
                </a>
              )}
              {venue.website && (
                <a href={venue.website} target="_blank" rel="noreferrer" className="vdp__sidebar-phone" style={{ display: 'block', marginTop: venue.phone ? 8 : 0 }}>
                  🌐 {venue.website.replace(/^https?:\/\//, '')}
                </a>
              )}
              <button
                type="button"
                className="btn btn-primary"
                style={{ width: '100%', marginTop: 12 }}
                onClick={() => setShowInquiry(true)}
              >
                Send Inquiry
              </button>
            </div>
          )}

          <div className="vdp__sidebar-card vdp__sidebar-stats">
            <div className="vdp__stat">
              <span className="vdp__stat-icon">🏟</span>
              <div>
                <p className="vdp__stat-value">{listings.length}</p>
                <p className="vdp__stat-label">Listings</p>
              </div>
            </div>
            {filterCategories.length > 0 && (
              <div className="vdp__stat">
                <span className="vdp__stat-icon">🎯</span>
                <div>
                  <p className="vdp__stat-value">{filterCategories.length}</p>
                  <p className="vdp__stat-label">Sports</p>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {showInquiry && <InquiryModal venue={venue} onClose={() => setShowInquiry(false)} />}
    </div>
  );
}
