import { useEffect, useRef, useState } from 'react';
import { ccApi, type BracketData, type BracketMatch, type BracketSide } from '../../lib/ccApi';

const POLL_MS = 30_000;

type BracketViewProps = {
  tournamentId: number;
  /** Poll for updates while the tournament is live. */
  live: boolean;
  /** Highlights matches containing this user. */
  myUserId?: number;
};

function fmtSchedule(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit',
  });
}

function Side({ side, winner, mine, slot }: {
  side: BracketSide | null;
  winner: string;
  mine: boolean;
  slot: 'A' | 'B';
}) {
  const won = winner === slot;
  const decided = winner !== '';
  const cls = [
    'bracket__side',
    side ? '' : 'bracket__side--tbd',
    won ? 'bracket__side--winner' : '',
    decided && !won && side ? 'bracket__side--loser' : '',
    mine ? 'bracket__side--me' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <span className="bracket__side-name">{side ? side.name : 'TBD'}</span>
      {side && decided ? <span className="bracket__side-score">{side.score}</span> : null}
    </div>
  );
}

function MatchCard({ m, myUserId }: { m: BracketMatch; myUserId?: number }) {
  const involvesMe = (side: BracketSide | null) =>
    Boolean(myUserId && side && side.user_ids.includes(myUserId));
  if (m.is_bye) {
    return (
      <div className="bracket__match bracket__match--bye">
        <Side side={m.side_a ?? m.side_b} winner={m.winner} mine={involvesMe(m.side_a ?? m.side_b)} slot={m.winner === 'B' ? 'B' : 'A'} />
        <div className="bracket__bye-tag">BYE</div>
      </div>
    );
  }
  return (
    <div className={`bracket__match${m.status === 'live' ? ' bracket__match--live' : ''}`}>
      <Side side={m.side_a} winner={m.winner} mine={involvesMe(m.side_a)} slot="A" />
      <Side side={m.side_b} winner={m.winner} mine={involvesMe(m.side_b)} slot="B" />
      {m.scheduled_at && m.status === 'scheduled' ? (
        <div className="bracket__match-when">{fmtSchedule(m.scheduled_at)}</div>
      ) : null}
    </div>
  );
}

export function BracketView({ tournamentId, live, myUserId }: BracketViewProps) {
  const [bracket, setBracket] = useState<BracketData | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Ref (not state) so the polling closure always sees the latest value —
  // a transient poll failure must not replace a loaded bracket with an error.
  const hasLoaded = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hasLoaded.current = false;
    const load = () => {
      ccApi.tournamentBracket(tournamentId)
        .then((b) => {
          if (cancelled) return;
          hasLoaded.current = true;
          setBracket(b);
          setError(null);
        })
        .catch((e) => {
          if (!cancelled && !hasLoaded.current) {
            setError(e instanceof Error ? e.message : 'Failed to load bracket');
          }
        });
    };
    load();
    if (!live) return () => { cancelled = true; };
    const timer = window.setInterval(load, POLL_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [tournamentId, live]);

  if (error) return <p className="muted small">Bracket unavailable — {error}</p>;
  if (!bracket) return <div className="tournament-card-skeleton" />;

  return (
    <div className="bracket">
      {bracket.stages.map((stage, si) => (
        <div key={`${stage.id}-${si}`} className="bracket__stage">
          <div className="bracket__stage-head">
            <h3 className="bracket__stage-name">{stage.name}</h3>
            {stage.venue ? (
              <span className="bracket__stage-venue">
                📍 {stage.venue.name}{stage.venue.city ? `, ${stage.venue.city}` : ''}
              </span>
            ) : stage.location_name ? (
              <span className="bracket__stage-venue">📍 {stage.location_name}</span>
            ) : null}
            {stage.starts_at ? (
              <span className="bracket__stage-when">🗓 {fmtSchedule(stage.starts_at)}</span>
            ) : null}
          </div>
          <div className="bracket__rounds">
            {stage.rounds.map((round) => (
              <div key={round.round_number} className="bracket__round">
                <div className="bracket__round-label">{round.label}</div>
                <div className="bracket__round-matches">
                  {round.matches.map((m) => (
                    <MatchCard key={m.id} m={m} myUserId={myUserId} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {live ? <p className="bracket__live-hint">Live — updates every 30s</p> : null}
    </div>
  );
}
