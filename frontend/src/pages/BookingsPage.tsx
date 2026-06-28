import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ccApi, type Booking } from '../lib/ccApi';

type BookingFilter = 'upcoming' | 'ongoing' | 'past' | 'all';

const now = () => new Date();

function getStatus(b: Booking): 'upcoming' | 'ongoing' | 'past' {
  if (!b.booking_date || !b.start_time || !b.end_time) return 'past';
  const start = new Date(`${b.booking_date}T${b.start_time}`);
  const end = new Date(`${b.booking_date}T${b.end_time}`);
  const n = now();
  if (n < start) return 'upcoming';
  if (n >= start && n <= end) return 'ongoing';
  return 'past';
}

function formatTime(t: string) {
  // "14:30:00" → "2:30 PM"
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
}

function formatDate(d: string) {
  if (!d) return '';
  const [y, mo, day] = d.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${day} ${months[Number(mo) - 1]} ${y}`;
}

const FILTER_TABS: { key: BookingFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'ongoing', label: 'Ongoing' },
  { key: 'past', label: 'History' },
];

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  upcoming: { label: 'Upcoming', color: '#0abfbc' },
  ongoing:  { label: 'Live now', color: '#4ade80' },
  past:     { label: 'Completed', color: '#6b7280' },
};

export function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<BookingFilter>('upcoming');

  useEffect(() => {
    ccApi.myBookings()
      .then(setBookings)
      .catch(() => setError('Could not load bookings.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = bookings.filter((b) => {
    if (filter === 'all') return true;
    return getStatus(b) === filter;
  });

  // Count per tab for badges
  const counts = {
    all: bookings.length,
    upcoming: bookings.filter((b) => getStatus(b) === 'upcoming').length,
    ongoing: bookings.filter((b) => getStatus(b) === 'ongoing').length,
    past: bookings.filter((b) => getStatus(b) === 'past').length,
  };

  return (
    <section className="section bookings-page">
      <div className="section-inner">
        <div className="bookings-page__head">
          <h1>My bookings</h1>
          <Link to="/turf" className="btn btn-primary btn-sm">+ Book a turf</Link>
        </div>

        {/* Filter tabs */}
        <div className="bookings-tabs" role="tablist">
          {FILTER_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={filter === t.key}
              className={`bookings-tab${filter === t.key ? ' bookings-tab--active' : ''}`}
              onClick={() => setFilter(t.key)}
            >
              {t.label}
              {counts[t.key] > 0 && (
                <span className="bookings-tab__badge">{counts[t.key]}</span>
              )}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="bookings-skeleton-list">
            {[1, 2, 3].map((i) => <div key={i} className="booking-card-skeleton" />)}
          </div>
        ) : error ? (
          <p className="auth-error">{error}</p>
        ) : filtered.length === 0 ? (
          <div className="bookings-empty">
            <p className="bookings-empty__icon">📅</p>
            <p className="bookings-empty__title">
              {filter === 'upcoming' ? 'No upcoming bookings' :
               filter === 'ongoing' ? 'No active sessions right now' :
               filter === 'past' ? 'No past bookings yet' :
               'No bookings yet'}
            </p>
            <p className="bookings-empty__sub">
              {filter !== 'past'
                ? 'Book a turf slot to see it here.'
                : 'Your booking history will appear here.'}
            </p>
            {filter !== 'past' && (
              <Link to="/turf" className="btn btn-primary btn-sm" style={{ marginTop: 16 }}>
                Browse venues →
              </Link>
            )}
          </div>
        ) : (
          <div className="bookings-list">
            {filtered.map((b) => {
              const statusKey = getStatus(b);
              const badge = STATUS_BADGE[statusKey];
              return (
                <div key={b.id} className={`booking-card booking-card--${statusKey}`}>
                  <div className="booking-card__left">
                    <div className="booking-card__date-block">
                      <span className="booking-card__day">
                        {b.booking_date ? b.booking_date.split('-')[2] : '—'}
                      </span>
                      <span className="booking-card__month">
                        {b.booking_date
                          ? ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][
                              Number(b.booking_date.split('-')[1]) - 1
                            ]
                          : ''}
                      </span>
                    </div>
                  </div>

                  <div className="booking-card__body">
                    <div className="booking-card__top-row">
                      <p className="booking-card__listing">
                        Listing #{b.listing_id}
                      </p>
                      <span
                        className="booking-card__status-badge"
                        style={{ color: badge.color, borderColor: badge.color }}
                      >
                        {statusKey === 'ongoing' && <span className="booking-card__pulse" />}
                        {badge.label}
                      </span>
                    </div>

                    <p className="booking-card__time">
                      🕐 {formatTime(b.start_time)} – {formatTime(b.end_time)}
                      <span className="booking-card__full-date"> · {formatDate(b.booking_date)}</span>
                    </p>

                    {b.num_players > 0 && (
                      <p className="booking-card__players">👥 {b.num_players} player{b.num_players > 1 ? 's' : ''}</p>
                    )}

                    <div className="booking-card__meta-row">
                      <span className={`booking-card__payment booking-card__payment--${b.payment_status ?? 'pending'}`}>
                        {b.payment_status === 'paid' ? '✓ Paid' :
                         b.payment_status === 'free' ? '✓ Free' :
                         b.payment_status ?? 'Pending'}
                      </span>
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
