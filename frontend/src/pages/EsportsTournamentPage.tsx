import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { formatLabel, statusLabel } from '../lib/platformUtils';
import { PageContainer } from '../components/ui/PageContainer';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';

export function EsportsTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tournaments, registerTournament, registered } = usePlatform();
  const [message, setMessage] = useState<string | null>(null);
  const t = tournaments.find((x) => x.id === id);

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

  const onRegister = () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/esports/tournament/${t.id}`)}`);
      return;
    }
    if (!registered) {
      navigate(`/register?next=${encodeURIComponent(`/esports/tournament/${t.id}`)}`);
      return;
    }
    const err = registerTournament(t.id);
    setMessage(err ?? 'Registration complete.');
  };

  const canRegister = t.status === 'live' && t.registrationOpen;

  return (
    <section className={`section section-esports${t.isExclusive ? ' esports-stage--exclusive' : ''}`}>
      <PageContainer>
        <Link className="muted small back-link" to="/esports">
          ← All tournaments
        </Link>
        <div className="tournament-detail__head">
          <span className={`status-pill status-pill--${t.status}`}>{statusLabel(t.status)}</span>
          {t.isExclusive ? <span className="status-pill status-pill--exclusive">Exclusive</span> : null}
        </div>
        <h1>{t.name}</h1>
        <p className="muted">
          {t.game} · {formatLabel(t.format)} · {t.mode} · {t.date}
        </p>
        <p>{t.description}</p>
        <h2>Rules</h2>
        <p className="muted">{t.rules}</p>
        <p className="muted small">
          {t.participants.length} / {t.participantsLimit} registered · {t.isPaid ? `INR ${t.entryFee}` : 'Free'}
        </p>
        {canRegister ? (
          <Button type="button" onClick={onRegister}>
            Register for tournament
          </Button>
        ) : null}
        {message ? <p className="muted small">{message}</p> : null}
        {t.winner ? (
          <p className="muted">
            Winner: {t.winner}
            {t.secondPlace ? ` · Runner-up: ${t.secondPlace}` : ''}
          </p>
        ) : null}
        <Link className="btn btn-ghost" to="/leaderboard">
          View leaderboard
        </Link>
      </PageContainer>
    </section>
  );
}
