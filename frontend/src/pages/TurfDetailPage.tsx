import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { PageContainer } from '../components/ui/PageContainer';
import { EmptyState } from '../components/ui/EmptyState';

export function TurfDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { turfs, registered, bookingDate, setBookingDate, bookSlot } = usePlatform();
  const [message, setMessage] = useState<string | null>(null);
  const turf = turfs.find((t) => t.id === id);

  if (!turf) {
    return (
      <section className="section">
        <PageContainer narrow>
          <EmptyState title="Turf not found" description="Return to browse available venues." />
          <Link className="btn btn-ghost" to="/turf">
            Back to turfs
          </Link>
        </PageContainer>
      </section>
    );
  }

  const onBook = (slotId: string) => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/turf/${turf.id}`)}`);
      return;
    }
    if (!registered) {
      navigate(`/register?next=${encodeURIComponent(`/turf/${turf.id}`)}`);
      return;
    }
    const result = bookSlot(turf.id, slotId);
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    navigate(`/turf/${turf.id}/confirm`, { state: { booking: result.booking } });
  };

  return (
    <section className="section section-turf">
      <PageContainer>
        <Link className="muted small back-link" to="/turf">
          ← All turfs
        </Link>
        <div className="section-head turf-detail-head">
          <p className="venue-card__city">{turf.city}</p>
          <h1>{turf.name}</h1>
          <p>{turf.description}</p>
        </div>
        <div className="booking-toolbar">
          <label htmlFor="booking-date">Booking date</label>
          <input
            id="booking-date"
            type="date"
            value={bookingDate}
            min={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setBookingDate(e.target.value)}
          />
        </div>
        <div className="slot-grid">
          {turf.slots.map((slot) => (
            <button
              key={slot.id}
              type="button"
              className={`slot-cell${slot.isBooked ? ' is-booked' : ''}`}
              disabled={slot.isBooked}
              onClick={() => onBook(slot.id)}
            >
              <span className="slot-time">{slot.label}</span>
              <span className="slot-state">{slot.isBooked ? 'Booked' : 'Available'}</span>
            </button>
          ))}
        </div>
        {message ? <p className="form-feedback form-feedback--error">{message}</p> : null}
        <p className="muted small">Payment gateway integration is stubbed. Your slot locks locally for this demo.</p>
      </PageContainer>
    </section>
  );
}
