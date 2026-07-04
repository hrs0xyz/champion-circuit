import { Link } from 'react-router-dom';
import type { Tournament } from '../../types/platform';
import { formatLabel, statusLabel } from '../../lib/platformUtils';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';

type TournamentCardProps = {
  tournament: Tournament;
  showRegister?: boolean;
  onRegister?: () => void;
  registerMessage?: string | null;
};

export function TournamentCard({ tournament: t, showRegister, onRegister, registerMessage }: TournamentCardProps) {
  return (
    <Card exclusive={t.isExclusive} className={`tournament-card tournament-card--${t.status}`}>
      <div className="tournament-card__head">
        <span className={`status-pill status-pill--${t.status}`}>{statusLabel(t.status)}</span>
        {t.isExclusive ? <span className="status-pill status-pill--exclusive">Exclusive</span> : null}
      </div>
      <h3>{t.name}</h3>
      <p className="muted small">
        {t.game} · {t.mode} · {formatLabel(t.format)} · {t.date}
      </p>
      <p>{t.description}</p>
      <p className="muted small">{t.isPaid ? `Paid entry · INR ${t.entryFee}` : 'Free entry'}</p>
      <div className="tournament-card__actions">
        <Link className="btn btn-ghost" to={`/esports/tournament/${t.id}`}>
          View details
        </Link>
        {showRegister && t.status === 'live' && t.registrationOpen ? (
          <Button type="button" onClick={onRegister}>
            Register
          </Button>
        ) : null}
      </div>
      {registerMessage ? <p className="muted small">{registerMessage}</p> : null}
    </Card>
  );
}
