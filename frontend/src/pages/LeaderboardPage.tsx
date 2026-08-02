import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import { CityBar } from '../components/ui/CityBar';
import { ccApi, type LeaderboardRow } from '../lib/ccApi';

const ALL_SPORTS = [
  'Cricket', 'Football', 'Badminton', 'Basketball', 'Table Tennis',
  'PUBG', 'BGMI', 'Valorant', 'Free Fire', 'FIFA', 'Chess', 'Carrom',
];

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';
function avatarSrc(url: string) {
  if (!url) return '';
  return url.startsWith('http') ? url : `${BASE}${url}`;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="lb-rank lb-rank--gold">🥇</span>;
  if (rank === 2) return <span className="lb-rank lb-rank--silver">🥈</span>;
  if (rank === 3) return <span className="lb-rank lb-rank--bronze">🥉</span>;
  return <span className="lb-rank">{rank}</span>;
}

export function LeaderboardPage() {
  const { user } = useAuth();
  const { cities } = useCity();

  const userSports = user?.interests ?? [];
  const orderedSports = [
    ...userSports.filter((s) => ALL_SPORTS.includes(s)),
    ...ALL_SPORTS.filter((s) => !userSports.includes(s)),
  ];
  const [sport, setSport] = useState(orderedSports[0] ?? 'All');
  const [period, setPeriod] = useState<'all_time' | 'monthly' | 'weekly'>('all_time');
  const [rows, setRows] = useState<LeaderboardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Array<{ id: number; name: string }>>([]);
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null);
  const [tournamentSearch, setTournamentSearch] = useState('');

  // Load tournaments for filter
  useEffect(() => {
    ccApi.tournaments({ status_filter: '', limit: 100 })
      .then((response) => {
        setTournaments(response.items.map(t => ({ id: t.id, name: t.name })));
      })
      .catch(() => setTournaments([]));
  }, []);

  useEffect(() => {
    setLoading(true);
    const scopeType = selectedTournament ? 'tournament' : (cities.length === 1 ? 'city' : 'global');
    const scopeId = selectedTournament ? String(selectedTournament) : (cities.length === 1 ? cities[0] : '');
    
    // Map UI sport names to backend game values
    let gameFilter = '';
    if (sport !== 'All') {
      gameFilter = sport.toLowerCase()
        .replace(' ', '_')  // "Table Tennis" -> "table_tennis"
        .replace('-', '_'); // handle any dashes
    }
    
    ccApi.leaderboard({ 
      scope_type: scopeType, 
      scope_id: scopeId, 
      period_type: period, 
      game: gameFilter,
      limit: 100 
    })
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [cities, period, selectedTournament, sport]);

  // Fuzzy search tournaments
  const filteredTournaments = tournaments.filter((t) => {
    if (!tournamentSearch) return true;
    return t.name.toLowerCase().includes(tournamentSearch.toLowerCase());
  });

  const myRow = user ? rows.find((r) => r.user_id === user.id) : null;

  return (
    <section className="section section-leaderboard">
      <div className="section-inner">
        <CityBar />

        <div className="section-head" style={{ marginTop: 24 }}>
          <h1>Leaderboard</h1>
          <p>
            {selectedTournament 
              ? `Tournament rankings: ${tournaments.find(t => t.id === selectedTournament)?.name || 'Loading...'}`
              : cities.length > 0 
                ? `Rankings in ${cities.join(', ')}` 
                : 'Global rankings'}
            {sport !== 'All' ? <> · <strong>{sport}</strong></> : null}.
          </p>
        </div>

        {/* Tournament filter */}
        <div style={{ marginBottom: 16 }}>
          <label htmlFor="tournament-filter" style={{ display: 'block', marginBottom: 8, fontSize: '14px', fontWeight: 500 }}>
            Filter by Tournament (optional)
          </label>
          <div style={{ display: 'flex', gap: 8, maxWidth: 600 }}>
            <input
              id="tournament-search"
              type="text"
              placeholder="Search tournaments..."
              value={tournamentSearch}
              onChange={(e) => setTournamentSearch(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#1a1f2e',
                border: '1px solid #2d3748',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
              }}
            />
            <select
              id="tournament-filter"
              value={selectedTournament || ''}
              onChange={(e) => setSelectedTournament(e.target.value ? Number(e.target.value) : null)}
              style={{
                flex: 2,
                padding: '8px 12px',
                background: '#1a1f2e',
                border: '1px solid #2d3748',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
              }}
            >
              <option value="">All Tournaments (Global)</option>
              {filteredTournaments.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            {selectedTournament && (
              <button
                type="button"
                onClick={() => { setSelectedTournament(null); setTournamentSearch(''); }}
                style={{
                  padding: '8px 16px',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '14px',
                  cursor: 'pointer',
                }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Period selector */}
        <div className="lb-period-row">
          {(['all_time', 'monthly', 'weekly'] as const).map((p) => (
            <button
              key={p}
              type="button"
              className={`lb-period-btn${period === p ? ' lb-period-btn--active' : ''}`}
              onClick={() => setPeriod(p)}
            >
              {p === 'all_time' ? 'All time' : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        {/* Sport filter */}
        <div className="lb-sport-chips" role="group" aria-label="Filter by sport">
          <button
            type="button"
            className={`lb-chip${sport === 'All' ? ' lb-chip--active' : ''}`}
            onClick={() => setSport('All')}
          >
            All
          </button>
          {orderedSports.map((s, i) => (
            <button
              key={s}
              type="button"
              className={`lb-chip${sport === s ? ' lb-chip--active' : ''}${i < userSports.length ? ' lb-chip--preferred' : ''}`}
              onClick={() => setSport(s)}
            >
              {s}
              {i === 0 && userSports.length > 0 ? <span className="lb-chip__star">★</span> : null}
            </button>
          ))}
        </div>

        {/* My rank callout */}
        {myRow ? (
          <div className="lb-my-callout">
            <span className="lb-my-callout__rank">#{myRow.rank}</span>
            <span className="lb-my-callout__label">Your current rank</span>
            <span className="lb-my-callout__pts">{myRow.total_points} pts</span>
          </div>
        ) : null}

        {/* Table */}
        {loading ? (
          <div className="lb-loading">
            {[1, 2, 3, 4, 5].map((i) => <div key={i} className="lb-row-skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="lb-empty">
            <p className="lb-empty__icon">🏆</p>
            <p className="lb-empty__title">No rankings yet</p>
            <p className="lb-empty__sub">Play matches at a verified venue to appear here.</p>
          </div>
        ) : (
          <div className="lb-list">
            {filtered.map((row) => (
              <div
                key={row.user_id}
                className={`lb-row${row.user_id === user?.id ? ' lb-row--me' : ''}`}
              >
                <RankBadge rank={row.rank} />
                <div className="lb-row__avatar">
                  {row.avatar_url ? (
                    <img src={avatarSrc(row.avatar_url)} alt={row.username} className="lb-row__avatar-img" />
                  ) : (
                    <span className="lb-row__avatar-init">{(row.name?.[0] ?? row.username?.[0] ?? 'C').toUpperCase()}</span>
                  )}
                </div>
                <div className="lb-row__player">
                  <span className="lb-row__name">{row.name || row.username}</span>
                  <span className="lb-row__username">@{row.username}</span>
                  {row.user_id === user?.id && <span className="lb-row__you">You</span>}
                </div>
                <div className="lb-row__stats">
                  <span className="lb-row__stat" title="Wins">W{row.wins}</span>
                  <span className="lb-row__stat lb-row__stat--loss" title="Losses">L{row.losses}</span>
                </div>
                <span className="lb-row__pts">
                  {row.total_points} <span className="lb-row__pts-label">pts</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {!myRow && user && filtered.length > 0 ? (
          <div className="lb-my-rank-hint">
            <span>You're not ranked yet.</span>
            <a href="/esports" className="lb-my-rank-hint__link">Join a tournament →</a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
