import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError, ccApi, type Tournament } from '../lib/ccApi';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

export function EsportsTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [t, setT] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    ccApi.tournament(Number(id))
      .then(setT)
      .catch(() => setT(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <section className="section section-esports">
        <PageContainer narrow>
          <div className="tournament-card-skeleton" />
        </PageContainer>
      </section>
    );
  }

  if (!t) {
    return (
      <section className="section">
        <PageContainer narrow>
          <EmptyState title="Tournament not found" />
          <Link className="btn btn-ghost" to="/esports">
            Back to esports
          </Link>
        </PageContainer>
      </section>
    );
  }

  const onRegister = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/esports/tournament/${t.id}`)}`);
      return;
    }
    setRegistering(true);
    try {
      await ccApi.registerTournament(t.id);
      setMessage('Registration complete.');
      const updated = await ccApi.tournament(t.id).catch(() => null);
      if (updated) setT(updated);
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Registration failed. Try again.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <section className={`section section-esports${t.is_exclusive ? ' esports-stage--exclusive' : ''}`}>
      <PageContainer>
        <Link className="muted small back-link" to="/esports">
          ← All tournaments
        </Link>
        <div className="tournament-detail__head">
          <span className={`status-pill status-pill--${t.status}`}>{t.status.toUpperCase()}</span>
          {t.is_exclusive ? <span className="status-pill status-pill--exclusive">Exclusive</span> : null}
        </div>
        <h1>{t.name}</h1>
        <p className="muted">
          {t.game} · {t.format.replace(/_/g, ' ')} · {t.mode}
          {t.starts_at ? ` · ${t.starts_at.slice(0, 10)}` : ''}
        </p>
        <p>{t.description}</p>
        {t.rules ? (
          <>
            <h2>Rules</h2>
            <p className="muted">{t.rules}</p>
          </>
        ) : null}
        {t.prize_description || t.prize_pool_paise > 0 ? (
          <p className="muted">
            🏆 {t.prize_description || `Prize pool: ₹${t.prize_pool_paise / 100}`}
          </p>
        ) : null}
        <p className="muted small">
          {t.participant_count} / {t.max_participants} registered ·{' '}
          {t.entry_fee_paise > 0 ? `₹${t.entry_fee_paise / 100} entry` : 'Free entry'}
        </p>
        {t.registration_open ? (
          <Button type="button" onClick={() => void onRegister()} disabled={registering}>
            {registering ? 'Registering…' : 'Register for tournament'}
          </Button>
        ) : null}
        {message ? <p className="muted small">{message}</p> : null}
        <Link className="btn btn-ghost" to="/leaderboard">
          View leaderboard
        </Link>
      </PageContainer>
    </section>
  );
}
