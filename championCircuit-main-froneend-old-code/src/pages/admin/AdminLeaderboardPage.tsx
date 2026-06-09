import { useState } from 'react';
import { usePlatform } from '../../context/PlatformContext';
import { LeaderboardTable } from '../../components/shared/LeaderboardTable';

export function AdminLeaderboardPage() {
  const { leaderboard, adjustLeaderboardPoints } = usePlatform();
  const [email, setEmail] = useState('');
  const [delta, setDelta] = useState(1);

  return (
    <div className="admin-page">
      <h1>Leaderboard</h1>
      <p className="muted">Manual point adjustments for corrections or bonuses.</p>
      <div className="admin-inline-form">
        <input className="admin-input" placeholder="Player email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          className="admin-input admin-input--narrow"
          type="number"
          value={delta}
          onChange={(e) => setDelta(Number(e.target.value))}
        />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => {
            if (!email.trim()) return;
            adjustLeaderboardPoints(email.trim(), delta, 'manual');
            setEmail('');
          }}
        >
          Apply points
        </button>
      </div>
      <LeaderboardTable rows={leaderboard} />
    </div>
  );
}
