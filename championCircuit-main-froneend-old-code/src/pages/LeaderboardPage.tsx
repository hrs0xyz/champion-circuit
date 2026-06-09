import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { usePlatform } from '../context/PlatformContext';
import { useCity } from '../context/CityContext';
import { CityBar } from '../components/ui/CityBar';
import { computeLeaderboard } from '../lib/platformUtils';

// ── Sport filter chips ────────────────────────────────────────────────────────

const ALL_SPORTS = [
  'Cricket', 'Football', 'Badminton', 'Basketball', 'Table Tennis',
  'PUBG', 'BGMI', 'Valorant', 'Free Fire', 'FIFA',
];

// ── Row component ─────────────────────────────────────────────────────────────

type Row = ReturnType<typeof computeLeaderboard>[number];

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="lb-rank lb-rank--gold">🥇</span>;
  if (rank === 2) return <span className="lb-rank lb-rank--silver">🥈</span>;
  if (rank === 3) return <span className="lb-rank lb-rank--bronze">🥉</span>;
  return <span className="lb-rank">{rank}</span>;
}

function LeaderboardRow({ row, rank, isMe }: { row: Row; rank: number; isMe: boolean }) {
  return (
    <div className={`lb-row${isMe ? ' lb-row--me' : ''}`}>
      <RankBadge rank={rank} />
      <div className="lb-row__player">
        <span className="lb-row__name">{row.player}</span>
        {isMe && <span className="lb-row__you">You</span>}
      </div>
      <span className="lb-row__pts">
        {row.points} <span className="lb-row__pts-label">pts</span>
      </span>
      <div className="lb-row__history">
        {row.history.map((h, i) => (
          <span key={i} className="lb-row__tag">{h}</span>
        ))}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LeaderboardPage() {
  const { user } = useAuth();
  const { tournaments } = usePlatform();
  const { matchesCity, cities } = useCity();

  // Sport filter — user's interests first
  const userSports = user?.interests ?? [];
  const orderedSports = [
    ...userSports.filter((s) => ALL_SPORTS.includes(s)),
    ...ALL_SPORTS.filter((s) => !userSports.includes(s)),
  ];
  const defaultSport = orderedSports[0] ?? 'All';
  const [sport, setSport] = useState(defaultSport);

  // Compute rows from local tournament data
  const allRows = computeLeaderboard(tournaments);
  const rows = sport === 'All'
    ? allRows
    : allRows.filter((r) =>
        tournaments.some(
          (t) =>
            (t.game === sport || t.name.toLowerCase().includes(sport.toLowerCase())) &&
            (t.participants.includes(r.player) || t.winner === r.player || t.secondPlace === r.player),
        ),
      );

  const myEmail = user?.email ?? '';

  return (
    <section className="section section-leaderboard">
      <div className="section-inner">

        {/* City bar — always show all cities */}
        <CityBar />

        {/* Header */}
        <div className="section-head" style={{ marginTop: 24 }}>
          <h1>Leaderboard</h1>
          <p>
            {cities.length > 0 ? `Rankings in ${cities.join(', ')}` : 'Rankings across all cities'}
            {sport !== 'All' ? <> · <strong>{sport}</strong></> : null}.
            {userSports.length > 0 && (
              <span className="lb-personalised-hint"> Your top sport is shown first.</span>
            )}
          </p>
        </div>

        {/* Sport filter chips */}
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

        {/* Under construction */}
        <div className="lb-construction-banner">
          <span className="lb-construction-banner__icon">🚧</span>
          <div>
            <p className="lb-construction-banner__title">Live city rankings coming soon</p>
            <p className="lb-construction-banner__sub">
              Real-time rankings are under construction. Preview below uses local tournament data.
            </p>
          </div>
        </div>

        {/* Rows */}
        {rows.length === 0 ? (
          <div className="lb-empty">
            <p className="lb-empty__icon">🏆</p>
            <p className="lb-empty__title">
              No rankings yet{sport !== 'All' ? ` for ${sport}` : ''}
            </p>
            <p className="lb-empty__sub">Register for a tournament to get on the board.</p>
          </div>
        ) : (
          <div className="lb-list">
            {rows.map((row, i) => (
              <LeaderboardRow
                key={row.player}
                row={row}
                rank={i + 1}
                isMe={!!myEmail && row.player === myEmail}
              />
            ))}
          </div>
        )}

        {myEmail && rows.length > 0 && !rows.find((r) => r.player === myEmail) ? (
          <div className="lb-my-rank-hint">
            <span>You're not on the board yet.</span>
            <a href="/esports" className="lb-my-rank-hint__link">Join a tournament →</a>
          </div>
        ) : null}

      </div>
    </section>
  );
}
