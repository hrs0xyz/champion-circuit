import { Link, useLocation, useParams } from 'react-router-dom';
import type { TurfBooking } from '../types/platform';
import { PageContainer } from '../components/ui/PageContainer';
import { EmptyState } from '../components/ui/EmptyState';

export function TurfConfirmPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const booking = (location.state as { booking?: TurfBooking } | null)?.booking;

  if (!booking) {
    return (
      <section className="section">
        <PageContainer narrow>
          <EmptyState title="No booking to show" description="Book a slot from the turf page first." />
          <Link className="btn btn-primary" to={`/turf/${id ?? ''}`}>
            Back to turf
          </Link>
        </PageContainer>
      </section>
    );
  }

  return (
    <section className="section">
      <PageContainer narrow>
        <div className="confirm-panel">
          <h1>Booking confirmed</h1>
          <p className="muted">Your slot is locked. Complete payment when the gateway is connected.</p>
          <ul className="confirm-list">
            <li>
              <strong>Venue:</strong> {booking.turfName}
            </li>
            <li>
              <strong>Slot:</strong> {booking.slotLabel}
            </li>
            <li>
              <strong>Date:</strong> {booking.date}
            </li>
          </ul>
          <div className="confirm-actions">
            <Link className="btn btn-primary" to="/bookings">
              My bookings
            </Link>
            <Link className="btn btn-ghost" to="/turf">
              Book another
            </Link>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
