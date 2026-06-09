import { Link, useNavigate } from 'react-router-dom';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import { CityBar } from '../components/ui/CityBar';
import { PageContainer } from '../components/ui/PageContainer';
import { Card } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';

export function TurfBrowsePage() {
  const { turfs } = usePlatform();
  const { user } = useAuth();
  const { matchesCity, cities } = useCity();
  const navigate = useNavigate();

  const list = turfs.filter((t) => matchesCity(t.city));

  const onSelect = (turfId: string) => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/turf/${turfId}`)}`);
      return;
    }
    navigate(`/turf/${turfId}`);
  };

  return (
    <section className="section section-turf">
      <PageContainer>
        <CityBar />

        <div className="section-head" style={{ marginTop: 24 }}>
          <h1>Book a turf</h1>
          <p>
            {cities.length > 0 ? `Showing venues in ${cities.join(', ')}.` : 'Browse all venues.'}
            {' '}Booked slots are greyed out on the next screen.
          </p>
        </div>

        {list.length === 0 ? (
          <EmptyState
            title={cities.length > 0 ? `No turfs in ${cities.join(' / ')} yet` : 'No turfs available'}
            description="Check back soon — venues are being added."
          />
        ) : (
          <div className="cards turf-cards">
            {list.map((turf) => {
              const available = turf.slots.filter((s) => !s.isBooked).length;
              return (
                <Card key={turf.id} className="venue-card">
                  <p className="venue-card__city">{turf.city}</p>
                  <h3>{turf.name}</h3>
                  <p className="venue-card__desc">{turf.description}</p>
                  <p className="venue-card__meta muted small">
                    {available} of {turf.slots.length} slots available
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => onSelect(turf.id)}
                  >
                    View slots
                  </button>
                </Card>
              );
            })}
          </div>
        )}

        {!user ? (
          <p className="auth-inline muted small turf-browse-foot">
            <Link className="auth-inline__link" to="/login">Sign in</Link>
            <span className="auth-inline__text"> to book, or </span>
            <Link className="auth-inline__link" to="/signup">create an account</Link>
            <span className="auth-inline__text">.</span>
          </p>
        ) : null}
      </PageContainer>
    </section>
  );
}
