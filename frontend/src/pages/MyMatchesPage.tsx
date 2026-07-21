import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { ccApi, type Match, type MyTournamentRegistration } from '../lib/ccApi';

const RESULT_COLOR: Record<string, string> = {
  win: '#4ade80',
  loss: '#f87171',
  draw: '#facc15',
  dnf: '#a3a3a3',
};

type Tab = 'matches' | 'tournaments';

function fmtSchedule(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
  });
}

function roundLabel(roundNumber: number, totalRounds: number): string {
  const remaining = totalRounds - roundNumber;
  if (remaining === 0) return 'Final';
  if (remaining === 1) return 'Semi Final';
  if (remaining === 2) return 'Quarter Final';
  return `Round ${roundNumber}`;
}

function TournamentsTab() {
  const [regs, setRegs] = useState<MyTournamentRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrOpenId, setQrOpenId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    ccApi.myTournamentRegistrations()
      .then(setRegs)
      .catch(() => setRegs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function withdraw(entry: MyTournamentRegistration) {
    const { tournament } = entry;
    if (!window.confirm(`Withdraw from ${tournament.name}? Your spot will be given away.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      await ccApi.withdrawTournament(tournament.id);
      setNotice(`Withdrawn from ${tournament.name}.`);
      load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Could not withdraw.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="lb-loading">
        {[1, 2, 3].map((i) => <div key={i} className="lb-row-skeleton" />)}
      </div>
    );
  }

  if (regs.length === 0) {
    return (
      <div className="lb-empty">
        <p className="lb-empty__icon">🏆</p>
        <p className="lb-empty__title">No tournament registrations yet</p>
        <p className="lb-empty__sub">
          <Link to="/tournaments">Browse tournaments</Link> and grab a free spot.
        </p>
      </div>
    );
  }

  return (
    <div>
      {notice ? <p className="auth-success trn-notice">{notice}</p> : null}
      {regs.map((entry) => {
        const { tournament: t, registration: r } = entry;
        const nm = r.next_match;
        return (
          <div key={r.id} className="trn-myreg-card">
            <div className="trn-myreg-card__head">
              <h3 className="trn-myreg-card__name">
                <Link to={`/tournaments/${t.slug}`}>{t.name}</Link>
              </h3>
              <span className={`status-pill status-pill--${t.status}`}>
                {t.status.replace('_', ' ').toUpperCase()}
              </span>
              {r.team_name ? <span className="muted small">Team {r.team_name}</span> : null}
              {r.checked_in_at ? <span className="trn-cta__badge">Checked in ✓</span> : null}
            </div>

            {nm ? (
              <div className="trn-myreg-card__fixture">
                ⚔️ <strong>{roundLabel(nm.round_number, nm.total_rounds)}</strong>
                {' vs '}{nm.opponent_name}
                {nm.scheduled_at ? ` · ${fmtSchedule(nm.scheduled_at)}` : ''}
                {nm.venue_name ? ` · ${nm.venue_name}` : ''}
              </div>
            ) : t.status === 'registration' ? (
              <p className="muted small" style={{ margin: '8px 0 0' }}>
                Awaiting bracket — you&apos;ll be notified when fixtures drop.
              </p>
            ) : null}

            {qrOpenId === r.id ? (
              <div className="checkin-qr">
                {r.qr_svg ? (
                  <div className="checkin-qr__svg" dangerouslySetInnerHTML={{ __html: r.qr_svg }} />
                ) : null}
                <p className="checkin-qr__code">Check-in code: <strong>{r.checkin_code}</strong></p>
                <p className="muted small">Show this at the venue desk on match day.</p>
              </div>
            ) : null}

            <div className="trn-myreg-card__actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setQrOpenId((v) => (v === r.id ? null : r.id))}
              >
                {qrOpenId === r.id ? 'Hide check-in QR' : 'Show check-in QR'}
              </button>
              {t.status === 'registration' ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm trn-cta__withdraw"
                  disabled={busy}
                  onClick={() => void withdraw(entry)}
                >
                  Withdraw
                </button>
              ) : null}
              <Link className="btn btn-ghost btn-sm" to={`/tournaments/${t.slug}`}>
                {t.status === 'live' ? 'View bracket' : 'View tournament'}
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function MyMatchesPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('matches');
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
          <h1>My matches</h1>
          <p>Your match history and tournament registrations.</p>
        </div>

        <div className="tab-row" role="tablist" aria-label="My matches sections">
          {(['matches', 'tournaments'] as const).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`tab-btn${tab === t ? ' is-active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t === 'matches' ? 'Matches' : 'Tournaments'}
            </button>
          ))}
        </div>

        {tab === 'tournaments' ? (
          <TournamentsTab />
        ) : loading ? (
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
