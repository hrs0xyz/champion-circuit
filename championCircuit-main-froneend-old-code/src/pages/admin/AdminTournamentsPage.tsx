import { usePlatform } from '../../context/PlatformContext';
import { formatLabel, statusLabel } from '../../lib/platformUtils';
import type { TournamentStatus } from '../../types/platform';

export function AdminTournamentsPage() {
  const { tournaments, updateTournamentStatus, setTournamentWinner } = usePlatform();

  return (
    <div className="admin-page">
      <h1>Tournaments</h1>
      <p className="muted">Update status and enter winners (updates leaderboard points).</p>
      {tournaments.map((t) => (
        <div key={t.id} className="admin-block card">
          <h2>{t.name}</h2>
          <p className="muted small">
            {statusLabel(t.status)} · {formatLabel(t.format)} · {t.isExclusive ? 'Exclusive' : 'Open'}
          </p>
          <div className="tab-row">
            {(['live', 'upcoming', 'completed'] as TournamentStatus[]).map((status) => (
              <button
                key={status}
                type="button"
                className={`tab-btn${t.status === status ? ' is-active' : ''}`}
                onClick={() => updateTournamentStatus(t.id, status)}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
          <div className="admin-inline-form">
            <input
              id={`winner-${t.id}`}
              placeholder="Winner email"
              defaultValue={t.winner ?? ''}
              className="admin-input"
            />
            <input
              id={`second-${t.id}`}
              placeholder="Runner-up email"
              defaultValue={t.secondPlace ?? ''}
              className="admin-input"
            />
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                const winner = (document.getElementById(`winner-${t.id}`) as HTMLInputElement).value.trim();
                const second = (document.getElementById(`second-${t.id}`) as HTMLInputElement).value.trim();
                if (winner) setTournamentWinner(t.id, winner, second || undefined);
              }}
            >
              Save results
            </button>
          </div>
          <p className="muted small">Participants: {t.participants.join(', ') || 'None'}</p>
        </div>
      ))}
    </div>
  );
}
