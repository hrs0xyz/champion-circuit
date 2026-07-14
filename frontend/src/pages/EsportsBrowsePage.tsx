import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CityBar } from '../components/ui/CityBar';
import { ccApi, type Tournament } from '../lib/ccApi';

const TABS = ['all', 'registration', 'live', 'completed'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  all: 'All', registration: 'Open', live: 'Live', completed: 'Completed',
};

const STATUS_DOT: Record<string, string> = {
  live: '#4ade80',
  registration: '#facc15',
  completed: '#a3a3a3',
  draft: '#555',
};

export function EsportsBrowsePage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('all');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ccApi.tournaments(tab !== 'all' ? { status_filter: tab } : {})
      .then(setTournaments)
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false));
  }, [tab]);

  return (
    <section className="section section-esports">
      <div className="section-inner">
        <CityBar />

        <div className="section-head" style={{ marginTop: 24 }}>
          <h1>Esports hub</h1>
          <p>Compete in structured brackets, earn leaderboard points, and join brand-exclusive events.</p>
        </div>

        {/* Tabs */}
        <div className="tab-row" role="tablist" aria-label="Tournament status">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`tab-btn${tab === t ? ' is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="tournament-grid-loading">
            {[1, 2, 3].map((i) => <div key={i} className="tournament-card-skeleton" />)}
          </div>
        ) : tournaments.length === 0 ? (
          <div className="lb-empty">
            <p className="lb-empty__icon">🏆</p>
            <p className="lb-empty__title">No tournaments {tab !== 'all' ? `with status "${TAB_LABELS[tab]}"` : ''}</p>
            <p className="lb-empty__sub">Check back soon.</p>
          </div>
        ) : (
          <div className="tournament-grid">
            {tournaments.map((t) => (
              <div key={t.id} className="tournament-card-new">
                {t.banner_url ? (
                  <div className="tournament-card-new__banner">
                    <img src={t.banner_url} alt={t.name} />
                  </div>
                ) : null}

                <div className="tournament-card-new__body">
                  <div className="tournament-card-new__header">
                    <div className="tournament-card-new__status-row">
                      <span
                        className="tournament-card-new__dot"
                        style={{ background: STATUS_DOT[t.status] ?? '#555' }}
                      />
                      <span className="tournament-card-new__status">{t.status.toUpperCase()}</span>
                      {t.is_exclusive && (
                        <span className="tournament-card-new__exclusive">EXCLUSIVE</span>
                      )}
                    </div>
                    <span className="tournament-card-new__game">{t.game}</span>
                  </div>

                  <h3 className="tournament-card-new__name">
                    <Link to={`/tournaments/${t.slug}`}>{t.name}</Link>
                  </h3>

                  <div className="tournament-card-new__meta">
                    <span>🎮 {t.mode} · {t.format.replace('_', ' ')}</span>
                    <span>👥 {t.participant_count}/{t.max_participants}</span>
                    {t.starts_at ? <span>📅 {t.starts_at.slice(0, 10)}</span> : null}
                  </div>

                  {t.prize_pool_paise > 0 && (
                    <p className="tournament-card-new__prize">
                      🏆 Prize pool: ₹{t.prize_pool_paise / 100}
                    </p>
                  )}

                  {t.description ? (
                    <p className="tournament-card-new__desc">{t.description}</p>
                  ) : null}

                  <div className="tournament-card-new__footer">
                    {t.entry_fee_paise > 0 ? (
                      <span className="tournament-card-new__fee">₹{t.entry_fee_paise / 100} entry</span>
                    ) : (
                      <span className="free-chip">FREE</span>
                    )}

                    {t.registration_effectively_open ? (
                      <Link className="btn btn-primary btn-sm" to={`/tournaments/${t.slug}`}>
                        Register
                      </Link>
                    ) : (
                      <Link className="muted small" to={`/tournaments/${t.slug}`}>
                        View details →
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!user ? (
          <p className="auth-inline muted small" style={{ marginTop: 24 }}>
            <Link className="auth-inline__link" to="/login">Sign in</Link>
            <span className="auth-inline__text"> to register for events.</span>
          </p>
        ) : null}
      </div>
    </section>
  );
}
