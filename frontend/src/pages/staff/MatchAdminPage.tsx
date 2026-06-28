/**
 * Match Admin Portal — /staff/match
 * For users assigned as match admin to a tournament.
 * They can: view participants, record matches, edit scores, verify matches.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ccApi, type Tournament, type Match } from '../../lib/ccApi';
import { ApiError } from '../../lib/api';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

async function staffReq<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('cc_token');
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    const b = await res.json().catch(() => ({}));
    throw new ApiError(res.status, b.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

interface Participant { user_id: number; username: string; name: string; payment_status: string; }

export function MatchAdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tab, setTab] = useState<'participants' | 'matches' | 'record'>('participants');
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/staff-login', { replace: true }); return; }
    // Fetch all tournaments to find ones this user is assigned to
    ccApi.tournaments()
      .then((ts) => { setTournaments(ts); if (ts.length > 0) selectTournament(ts[0]); })
      .catch(() => setMsg('Could not load tournaments.'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  async function selectTournament(t: Tournament) {
    setSelected(t);
    setLoading(true);
    try {
      const [ps, ms] = await Promise.all([
        staffReq<Participant[]>(`/api/staff/tournaments/${t.id}/participants`),
        staffReq<Match[]>(`/api/staff/tournaments/${t.id}/matches`),
      ]);
      setParticipants(ps);
      setMatches(ms);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Could not load tournament data.');
    } finally {
      setLoading(false);
    }
  }

  if (loading && !selected) return (
    <div className="staff-shell">
      <div className="staff-main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="muted">Loading…</p>
      </div>
    </div>
  );

  return (
    <div className="staff-shell">
      <aside className="staff-sidebar">
        <div className="staff-sidebar__brand">
          <img src="/branding/cc-mark.png" alt="CC" width={32} />
          <span>Match Admin</span>
        </div>
        <p className="staff-sidebar__label">Tournament</p>
        {tournaments.map((t) => (
          <button key={t.id} type="button"
            className={`staff-nav-btn${selected?.id === t.id ? ' staff-nav-btn--active' : ''}`}
            onClick={() => void selectTournament(t)}>
            {t.name.length > 22 ? t.name.slice(0, 22) + '…' : t.name}
          </button>
        ))}
        {user?.is_venue_owner && (
          <button type="button" className="staff-nav-btn" onClick={() => navigate('/staff/venue')}>← Venue portal</button>
        )}
        <button type="button" className="staff-nav-btn staff-nav-btn--logout"
          onClick={() => { signOut(); navigate('/staff-login'); }}>Sign out</button>
      </aside>

      <main className="staff-main">
        {msg ? <p className="staff-msg">{msg}</p> : null}
        {!selected ? (
          <div className="staff-section">
            <h2 className="staff-h2">No tournaments assigned</h2>
            <p className="muted">Ask a turf owner or super admin to assign you as match admin for a tournament.</p>
          </div>
        ) : (
          <>
            <div className="staff-section__header" style={{ marginBottom: 16 }}>
              <h2 className="staff-h2">{selected.name}</h2>
              <span className="staff-badge">{selected.status}</span>
            </div>

            <div className="tab-row" style={{ marginBottom: 20 }}>
              {(['participants', 'matches', 'record'] as const).map((t) => (
                <button key={t} type="button"
                  className={`tab-btn${tab === t ? ' is-active' : ''}`}
                  onClick={() => setTab(t)}>
                  {t === 'record' ? 'Record match' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {tab === 'participants' && <ParticipantsList participants={participants} />}
            {tab === 'matches' && <MatchList matches={matches} onVerify={async (id) => {
              try {
                await staffReq(`/api/staff/matches/${id}/verify`, { method: 'POST' });
                const ms = await staffReq<Match[]>(`/api/staff/tournaments/${selected.id}/matches`);
                setMatches(ms); setMsg('Match verified and points awarded.');
              } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
            }} onEdit={async (id, data) => {
              try {
                await staffReq(`/api/staff/matches/${id}`, { method: 'PUT', body: JSON.stringify(data) });
                const ms = await staffReq<Match[]>(`/api/staff/tournaments/${selected.id}/matches`);
                setMatches(ms); setMsg('Match updated.');
              } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
            }} />}
            {tab === 'record' && (
              <RecordMatch
                tournamentId={selected.id}
                participants={participants}
                onDone={async () => {
                  const ms = await staffReq<Match[]>(`/api/staff/tournaments/${selected.id}/matches`);
                  setMatches(ms); setTab('matches'); setMsg('Match recorded.');
                }}
                onMsg={setMsg}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

function ParticipantsList({ participants }: { participants: Participant[] }) {
  return (
    <div className="staff-section">
      <h3 className="staff-h3">Participants ({participants.length})</h3>
      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead><tr><th>Username</th><th>Name</th><th>Payment</th></tr></thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.user_id}>
                <td>@{p.username}</td>
                <td>{p.name}</td>
                <td><span className={`staff-badge${p.payment_status === 'paid' ? ' staff-badge--active' : ''}`}>{p.payment_status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchList({ matches, onVerify, onEdit }: {
  matches: Match[];
  onVerify: (id: number) => void;
  onEdit: (id: number, data: object) => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});

  return (
    <div className="staff-section">
      <h3 className="staff-h3">Matches ({matches.length})</h3>
      {matches.length === 0 ? <p className="muted">No matches recorded yet.</p> : matches.map((m) => (
        <div key={m.id} className="staff-card">
          <div className="staff-card__header">
            <div>
              <p className="staff-card__meta">{m.match_type} · {m.game_mode} · {m.participants.length} players</p>
              {m.played_at && <p className="staff-card__meta muted small">{m.played_at.slice(0, 10)}</p>}
            </div>
            <div className="staff-card__badges">
              <span className={`staff-badge${m.status === 'completed' ? ' staff-badge--active' : ''}`}>{m.status}</span>
            </div>
          </div>

          {/* Participants scores */}
          <div className="match-admin-scores">
            {m.participants.map((p) => (
              <div key={p.user_id} className="match-admin-score-row">
                <span className="match-admin-score-row__user">User #{p.user_id}</span>
                <span className="match-admin-score-row__result" style={{ color: p.result === 'win' ? '#4ade80' : p.result === 'loss' ? '#f87171' : '#fff' }}>
                  {p.result || '—'}
                </span>
                <span className="match-admin-score-row__pts">{p.points_earned} pts</span>
              </div>
            ))}
          </div>

          <div className="staff-card__actions">
            {m.status !== 'completed' && (
              <>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onVerify(m.id)}>
                  Verify & award points
                </button>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => {
                  setEditing(m.id);
                  setEditData({ notes: m.notes, participants: m.participants.map((p) => ({ ...p })) });
                }}>
                  Edit scores
                </button>
              </>
            )}
          </div>

          {editing === m.id && (
            <div className="staff-edit-scores">
              <p className="staff-h3" style={{ marginBottom: 12 }}>Edit scores</p>
              {(editData.participants as typeof m.participants).map((p, i) => (
                <div key={p.user_id} className="staff-score-edit-row">
                  <span>User #{p.user_id}</span>
                  <select className="auth-input" style={{ width: 100 }} value={p.result}
                    onChange={(e) => {
                      const ps = [...(editData.participants as typeof m.participants)];
                      ps[i] = { ...ps[i], result: e.target.value };
                      setEditData({ ...editData, participants: ps });
                    }}>
                    {['', 'win', 'loss', 'draw', 'dnf'].map((r) => <option key={r} value={r}>{r || 'no result'}</option>)}
                  </select>
                  <input className="auth-input" type="number" placeholder="Score" style={{ width: 80 }}
                    value={(p as typeof p & { score: number }).score}
                    onChange={(e) => {
                      const ps = [...(editData.participants as typeof m.participants)];
                      ps[i] = { ...ps[i], score: Number(e.target.value) };
                      setEditData({ ...editData, participants: ps });
                    }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => { onEdit(m.id, editData); setEditing(null); }}>Save</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function RecordMatch({ tournamentId, participants, onDone, onMsg }: {
  tournamentId: number;
  participants: Participant[];
  onDone: () => void;
  onMsg: (m: string) => void;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [results, setResults] = useState<Record<number, string>>({});
  const [scores, setScores] = useState<Record<number, number>>({});
  const [matchType, setMatchType] = useState('tournament');
  const [gameMode, setGameMode] = useState('team_vs_team');

  function togglePlayer(uid: number) {
    setSelected((prev) => prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      venue_id: 0,
      tournament_id: tournamentId,
      match_type: matchType,
      game_mode: gameMode,
      played_at: new Date().toISOString(),
      participants: selected.map((uid) => ({
        user_id: uid,
        result: results[uid] ?? '',
        score: scores[uid] ?? 0,
        team: 'none', role: 'player',
      })),
    };
    try {
      await ccApi.createMatch(payload);
      onDone();
    } catch (e) { onMsg(e instanceof ApiError ? e.message : 'Failed to record match'); }
  }

  return (
    <div className="staff-section">
      <h3 className="staff-h3">Record a match</h3>
      <form onSubmit={(e) => void handleSubmit(e)}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div className="auth-field" style={{ flex: 1 }}>
            <label className="auth-label">Match type</label>
            <select className="auth-input" value={matchType} onChange={(e) => setMatchType(e.target.value)}>
              <option value="tournament">Tournament</option>
              <option value="ranked">Ranked</option>
              <option value="casual">Casual</option>
            </select>
          </div>
          <div className="auth-field" style={{ flex: 1 }}>
            <label className="auth-label">Game mode</label>
            <select className="auth-input" value={gameMode} onChange={(e) => setGameMode(e.target.value)}>
              <option value="team_vs_team">Team vs Team</option>
              <option value="solo">Solo</option>
              <option value="squad">Squad</option>
            </select>
          </div>
        </div>

        <p className="auth-label" style={{ marginBottom: 8 }}>Select players and set results</p>
        <div className="staff-player-select">
          {participants.map((p) => (
            <div key={p.user_id} className={`staff-player-row${selected.includes(p.user_id) ? ' staff-player-row--selected' : ''}`}>
              <label className="staff-checkbox" style={{ flex: 1 }}>
                <input type="checkbox" checked={selected.includes(p.user_id)} onChange={() => togglePlayer(p.user_id)} />
                @{p.username} {p.name ? `(${p.name})` : ''}
              </label>
              {selected.includes(p.user_id) && (
                <>
                  <select className="auth-input" style={{ width: 90 }} value={results[p.user_id] ?? ''}
                    onChange={(e) => setResults({ ...results, [p.user_id]: e.target.value })}>
                    <option value="">Result</option>
                    {['win','loss','draw','dnf'].map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <input className="auth-input" type="number" placeholder="Score" style={{ width: 70 }}
                    value={scores[p.user_id] ?? ''}
                    onChange={(e) => setScores({ ...scores, [p.user_id]: Number(e.target.value) })} />
                </>
              )}
            </div>
          ))}
        </div>

        <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={selected.length === 0}>
          Record match
        </button>
      </form>
    </div>
  );
}
