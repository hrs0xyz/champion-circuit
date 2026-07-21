import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CityBar } from '../components/ui/CityBar';
import { useCity } from '../context/CityContext';
import { ccApi, type Category, type Tournament } from '../lib/ccApi';

const TABS = ['upcoming', 'live', 'completed', 'all'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  upcoming: 'Upcoming', live: 'Live', completed: 'Completed', all: 'All',
};

/** Maps a UI tab onto the backend status filter. */
const TAB_STATUS: Record<Tab, string> = {
  upcoming: 'registration', live: 'live', completed: 'completed', all: '',
};

const STATUS_DOT: Record<string, string> = {
  live: '#4ade80',
  registration: '#facc15',
  completed: '#a3a3a3',
  cancelled: '#f87171',
};

type TypeChip = 'all' | 'physical' | 'esports';

export function feeLabel(t: Tournament): string {
  return t.entry_fee_paise === 0 ? 'FREE' : `₹${t.entry_fee_paise / 100}`;
}

export function TournamentsBrowsePage() {
  const { matchesCity } = useCity();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [typeChip, setTypeChip] = useState<TypeChip>('all');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ccApi.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const status = TAB_STATUS[tab];
    ccApi.tournaments(status ? { status_filter: status } : {})
      .then(setTournaments)
      .catch(() => setTournaments([]))
      .finally(() => setLoading(false));
  }, [tab]);

  const typeBySlug = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of categories) map[c.slug] = c.type;
    return map;
  }, [categories]);

  const visible = useMemo(() => {
    const filtered = tournaments.filter((t) => {
      // City: tournaments follow their primary venue's city; venue-less events always pass
      if (t.venue?.city && !matchesCity(t.venue.city)) return false;
      if (typeChip !== 'all') {
        const gameType = typeBySlug[t.game];
        // Unknown game slugs stay visible under every type chip
        if (gameType && gameType !== typeChip) return false;
      }
      return true;
    });
    // Featured cards pinned first, then soonest start date
    return filtered.sort((a, b) => {
      if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
      return (a.starts_at || '9999').localeCompare(b.starts_at || '9999');
    });
  }, [tournaments, matchesCity, typeChip, typeBySlug]);

  return (
    <section className="section section-esports">
      <div className="section-inner">
        <CityBar />

        <div className="section-head" style={{ marginTop: 24 }}>
          <h1>Tournaments</h1>
          <p>Free-entry turf and esports tournaments across the circuit — register, compete, climb the leaderboard.</p>
        </div>

        {/* Status tabs */}
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

        {/* Category type chips */}
        <div className="trn-type-row" role="group" aria-label="Category">
          {([['all', 'All'], ['physical', 'Sports'], ['esports', 'Esports']] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`lb-chip${typeChip === key ? ' lb-chip--active' : ''}`}
              onClick={() => setTypeChip(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="tournament-grid-loading">
            {[1, 2, 3].map((i) => <div key={i} className="tournament-card-skeleton" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="lb-empty">
            <p className="lb-empty__icon">🏆</p>
            <p className="lb-empty__title">No tournaments {tab !== 'all' ? `in "${TAB_LABELS[tab]}"` : ''} right now</p>
            <p className="lb-empty__sub">New events drop regularly — check back soon.</p>
          </div>
        ) : (
          <div className="tournament-grid">
            {visible.map((t) => (
              <Link key={t.id} to={`/tournaments/${t.slug}`} className="tournament-card-new trn-card-link">
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
                      {t.is_featured && <span className="tournament-card-new__exclusive">FEATURED</span>}
                    </div>
                    <span className="tournament-card-new__game">{t.game}</span>
                  </div>

                  <h3 className="tournament-card-new__name">{t.name}</h3>

                  <div className="tournament-card-new__meta">
                    <span>🎮 {t.mode} · {t.format.replace(/_/g, ' ')}</span>
                    <span>👥 {t.participant_count}/{t.max_participants}</span>
                    {t.starts_at ? <span>📅 {t.starts_at.slice(0, 10)}</span> : null}
                    {t.venue ? <span>📍 {t.venue.name}{t.venue.city ? `, ${t.venue.city}` : ''}</span> : null}
                  </div>

                  {t.prize_pool_paise > 0 && (
                    <p className="tournament-card-new__prize">
                      🏆 Prize pool: ₹{t.prize_pool_paise / 100}
                    </p>
                  )}

                  <div className="tournament-card-new__footer">
                    <span className={t.entry_fee_paise === 0 ? 'free-chip' : 'tournament-card-new__fee'}>
                      {feeLabel(t)}
                    </span>
                    {t.registration_effectively_open ? (
                      <span className="btn btn-primary btn-sm">Register →</span>
                    ) : (
                      <span className="muted small">View details →</span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
