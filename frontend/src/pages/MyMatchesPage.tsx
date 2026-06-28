import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ccApi, type Match } from '../lib/ccApi';

const RESULT_COLOR: Record<string, string> = {
  win: '#4ade80',
  loss: '#f87171',
  draw: '#facc15',
  dnf: '#a3a3a3',
};

export function MyMatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ccApi.myMatches()
      .then(setMatches)
      .catch(() => setMatches([]))
      .finally(() => setLoading(false));
  }, []);

  if (!user) return null;

  const myParticipant = (m: Match) => m.participants.find((p) => p.user_id === user.id);

  return (
    <section className="section section-my-matches">
      <div className="section-inner">
        <div className="section-head">
          <h1>Match history</h1>
          <p>All matches recorded at Champion Circuit venues.</p>
        </div>

        {loading ? (
          <div className="lb-loading">
            {[1, 2, 3].map((i) => <div key={i} className="lb-row-skeleton" />)}
          </div>
        ) : matches.length === 0 ? (
          <div className="lb-empty">
            <p className="lb-empty__icon">🎮</p>
            <p className="lb-empty__title">No matches yet</p>
            <p className="lb-empty__sub">Play at a venue to see your match history here.</p>
          </div>
        ) : (
          <div className="match-list">
            {matches.map((m) => {
              const me = myParticipant(m);
              return (
                <div key={m.id} className={`match-row match-row--${m.status}`}>
                  <div className="match-row__type">
                    <span className={`match-type-badge match-type-badge--${m.match_type}`}>
                      {m.match_type}
                    </span>
                    <span className="match-row__mode muted small">{m.game_mode}</span>
                  </div>

                  <div className="match-row__info">
                    {m.played_at ? (
                      <span className="match-row__date muted small">
                        {new Date(m.played_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    ) : null}
                    <span className="match-row__players muted small">
                      {m.participants.length} player{m.participants.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {me ? (
                    <div className="match-row__my-result">
                      <span
                        className="match-row__result"
                        style={{ color: RESULT_COLOR[me.result] ?? '#fff' }}
                      >
                        {me.result?.toUpperCase() || '—'}
                      </span>
                      {me.score > 0 && (
                        <span className="match-row__score muted small">Score: {me.score}</span>
                      )}
                      {me.points_earned > 0 && (
                        <span className="match-row__pts">+{me.points_earned} pts</span>
                      )}
                    </div>
                  ) : null}

                  <span className={`match-row__status match-row__status--${m.status}`}>
                    {m.status}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
