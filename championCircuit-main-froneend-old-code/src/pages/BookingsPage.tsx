import { Link } from 'react-router-dom';
import { usePlatform } from '../context/PlatformContext';
import { PageContainer } from '../components/ui/PageContainer';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

export function BookingsPage() {
  const { bookings, profile } = usePlatform();
  const mine = bookings.filter((b) => b.email === profile.email);

  return (
    <section className="section">
      <PageContainer>
        <div className="section-head">
          <h1>My bookings</h1>
        </div>
        {mine.length === 0 ? (
          <EmptyState title="No bookings yet" description="Book a turf slot to see confirmations here." />
        ) : (
          <div className="cards">
            {mine.map((b) => (
              <Card key={b.id}>
                <h3>{b.turfName}</h3>
                <p>
                  {b.slotLabel} · {b.date}
                </p>
                <p className="muted small">Booked {new Date(b.createdAt).toLocaleString()}</p>
              </Card>
            ))}
          </div>
        )}
        <Link className="btn btn-primary" to="/turf">
          Book a turf
        </Link>
      </PageContainer>
    </section>
  );
}
