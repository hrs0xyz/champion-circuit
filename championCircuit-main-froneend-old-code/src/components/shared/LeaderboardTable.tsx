import type { computeLeaderboard } from '../../lib/platformUtils';

type Row = ReturnType<typeof computeLeaderboard>[number];

export function LeaderboardTable({ rows }: { rows: Row[] }) {
  if (rows.length === 0) {
    return <p className="muted">No points recorded yet. Register for a tournament to get on the board.</p>;
  }
  return (
    <div className="leaderboard-teal">
      <table className="points-table">
        <thead>
          <tr>
            <th scope="col">Rank</th>
            <th scope="col">Player</th>
            <th scope="col">Points</th>
            <th scope="col">Activity</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.player}>
              <td>{i + 1}</td>
              <td>{row.player}</td>
              <td>{row.points}</td>
              <td className="points-history">{row.history.join(' · ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
