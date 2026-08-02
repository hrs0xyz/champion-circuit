/**
 * Match Admin Portal — /staff/match
 * For users assigned as match admin to a tournament.
 * They can: view participants, check players in, record matches, edit scores,
 * schedule bracket matches, verify results (auto-advances the bracket) and
 * resolve no-shows with walkovers.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ccApi, type Match, type StaffParticipant, type Tournament } from '../../lib/ccApi';
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

function roundLabel(m: Match, totalRounds: number): string {
  if (m.round_number <= 0) return '';
  const remaining = totalRounds - m.round_number;
  const label = remaining === 0 ? 'Final'
    : remaining === 1 ? 'Semi Final'
    : remaining === 2 ? 'Quarter Final'
    : `Round ${m.round_number}`;
  return `${label} · M${m.bracket_position + 1}`;
}

export function MatchAdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<StaffParticipant[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [tab, setTab] = useState<'participants' | 'matches' | 'record' | 'tournaments' | 'groups'>('participants');
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');
  const [loading, setLoading] = useState(true);
  const [showRemindDialog, setShowRemindDialog] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [scanError, setScanError] = useState('');

  useEffect(() => {
    if (!user) { navigate('/match-admin-login', { replace: true }); return; }
    // Only staff (match admin / owner / super admin) may view this portal.
    if (!user.is_match_admin && !user.is_venue_owner && !user.is_admin) {
      navigate('/match-admin-login', { replace: true });
      return;
    }
    ccApi.assignedTournaments()
      .then((ts) => { setTournaments(ts); if (ts.length > 0) void selectTournament(ts[0]); })
      .catch(() => setMsg('Could not load tournaments.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  async function refreshData(t: Tournament) {
    const [ps, ms] = await Promise.all([
      ccApi.staffTournamentParticipants(t.id),
      staffReq<Match[]>(`/api/staff/tournaments/${t.id}/matches`),
    ]);
    setParticipants(ps);
    setMatches(ms);
  }

  async function selectTournament(t: Tournament) {
    setSelected(t);
    setLoading(true);
    try {
      await refreshData(t);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Could not load tournament data.');
    } finally {
      setLoading(false);
    }
  }

  async function downloadCsv() {
    if (!selected) return;
    try { await ccApi.downloadRegistrationsCsv(selected.id, selected.slug); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : 'Download failed.'); }
  }

  async function remind() {
    setShowRemindDialog(true);
  }

  async function sendReminders() {
    if (!selected) return;
    try {
      const payload = selectedUsers.length > 0 ? { user_ids: selectedUsers } : undefined;
      const res = await staffReq<{ notified: number }>(
        `/api/staff/tournaments/${selected.id}/remind-checkin`,
        { method: 'POST', body: JSON.stringify(payload || {}) }
      );
      setMsg(`Check-in reminder sent to ${res.notified} participant(s).`);
      setShowRemindDialog(false);
      setSelectedUsers([]);
    } catch (e) { 
      setMsg(e instanceof ApiError ? e.message : 'Failed.'); 
    }
  }

  // Non-staff are redirected by the effect above — render nothing meanwhile.
  if (user && !user.is_match_admin && !user.is_venue_owner && !user.is_admin) return null;

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
          onClick={() => { signOut(); navigate('/match-admin-login'); }}>Sign out</button>
      </aside>

      <main className="staff-main">
        {msg ? (
          <div className={`staff-msg ${msgType === 'error' ? 'staff-msg--error' : 'staff-msg--success'}`}>
            {msgType === 'error' ? '⚠️ ' : '✓ '}{msg}
          </div>
        ) : null}
        {!selected ? (
          <div className="staff-section">
            <h2 className="staff-h2">No tournaments assigned</h2>
            <p className="muted">Ask a turf owner or super admin to assign you as match admin for a tournament.</p>
          </div>
        ) : (
          <>
            <div className="staff-section__header" style={{ marginBottom: 16 }}>
              <h2 className="staff-h2">{selected.name}</h2>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span className="staff-badge">{selected.status.replace('_', ' ')}</span>
                <button type="button" className="staff-action-btn" onClick={() => void downloadCsv()}>⬇ CSV</button>
                <button type="button" className="staff-action-btn" onClick={() => void remind()}>🔔 Remind check-in</button>
              </div>
            </div>

            <div className="tab-row" style={{ marginBottom: 20 }}>
              {(['participants', 'matches', 'record', 'groups', 'tournaments'] as const).map((t) => (
                <button key={t} type="button"
                  className={`tab-btn${tab === t ? ' is-active' : ''}`}
                  onClick={() => setTab(t)}>
                  {t === 'record' ? 'Record match' : t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            {tab === 'participants' && (
              <ParticipantsList
                tournamentId={selected.id}
                participants={participants}
                onChanged={() => void refreshData(selected)}
                onMsg={(msg, type) => { setMsg(msg); if (type) setMsgType(type); }}
              />
            )}
            {tab === 'matches' && <MatchList matches={matches} onVerify={async (id) => {
              try {
                await staffReq(`/api/staff/matches/${id}/verify`, { method: 'POST' });
                await refreshData(selected);
                setMsg('Match verified — points awarded and the bracket advanced.');
              } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
            }} onEdit={async (id, data) => {
              try {
                await staffReq(`/api/staff/matches/${id}`, { method: 'PUT', body: JSON.stringify(data) });
                await refreshData(selected);
                setMsg('Match updated.');
              } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
            }} onWalkover={async (id, side) => {
              const reason = window.prompt(`Walkover — side ${side} wins. Reason (e.g. "opponent no-show"):`);
              if (reason === null) return;
              try {
                await ccApi.walkoverMatch(id, side, reason);
                await refreshData(selected);
                setMsg(`Walkover recorded — side ${side} advances.`);
              } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
            }} />}
            {tab === 'record' && (
              <RecordMatch
                tournamentId={selected.id}
                participants={participants}
                onDone={async () => {
                  await refreshData(selected);
                  setTab('matches'); setMsg('Match recorded.');
                }}
                onMsg={setMsg}
              />
            )}
            {tab === 'tournaments' && selected && (
              <TournamentManagement
                tournament={selected}
                onUpdate={() => {
                  ccApi.assignedTournaments().then(setTournaments).catch(() => {});
                  setMsg('Tournament updated.');
                  setMsgType('success');
                }}
                onMsg={(msg, type) => { 
                  setMsg(msg); 
                  if (type) setMsgType(type); 
                }}
              />
            )}
            {tab === 'groups' && selected && (
              <GroupsManagement
                tournament={selected}
                onUpdate={() => void refreshData(selected)}
                onMsg={(msg, type) => { 
                  setMsg(msg); 
                  if (type) setMsgType(type); 
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Remind Check-in Dialog */}
      {showRemindDialog && selected && (
        <div className="modal-overlay" onClick={() => setShowRemindDialog(false)}>
          <div className="modal-content" style={{ maxWidth: 700 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">📧 Send Check-in Reminders</h2>
              <button type="button" className="modal-close" onClick={() => setShowRemindDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ marginBottom: 16, color: '#d4d4d8' }}>
                Select participants who need a check-in reminder email. The email will include their check-in code and tournament details.
              </p>
              
              <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
                <button 
                  type="button" 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => {
                    const notCheckedIn = participants.filter(p => !p.checked_in_at).map(p => p.user_id);
                    setSelectedUsers(notCheckedIn);
                  }}
                >
                  ✓ Select All Non-Checked-In ({participants.filter(p => !p.checked_in_at).length})
                </button>
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm" 
                  onClick={() => setSelectedUsers([])}
                >
                  ✕ Clear Selection
                </button>
              </div>

              {participants.filter(p => !p.checked_in_at).length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', background: '#0d1117', borderRadius: 8 }}>
                  <p style={{ fontSize: 48, margin: 0 }}>🎉</p>
                  <p style={{ margin: '12px 0 0 0', color: '#0abfbc', fontWeight: 600 }}>All participants have checked in!</p>
                </div>
              ) : (
                <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #2a3544', borderRadius: 8 }}>
                  <table className="staff-table" style={{ marginBottom: 0 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>
                          <input 
                            type="checkbox"
                            checked={selectedUsers.length === participants.filter(p => !p.checked_in_at).length && participants.filter(p => !p.checked_in_at).length > 0}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedUsers(participants.filter(p => !p.checked_in_at).map(p => p.user_id));
                              } else {
                                setSelectedUsers([]);
                              }
                            }}
                          />
                        </th>
                        <th>Username</th>
                        <th>Name</th>
                        <th>Phone</th>
                        <th>Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.filter(p => !p.checked_in_at).map((p) => (
                        <tr key={p.user_id} style={{ background: selectedUsers.includes(p.user_id) ? '#0abfbc11' : 'transparent' }}>
                          <td>
                            <input 
                              type="checkbox" 
                              checked={selectedUsers.includes(p.user_id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedUsers([...selectedUsers, p.user_id]);
                                } else {
                                  setSelectedUsers(selectedUsers.filter(id => id !== p.user_id));
                                }
                              }}
                            />
                          </td>
                          <td>@{p.username}</td>
                          <td>{p.name || '—'}</td>
                          <td style={{ fontSize: 13 }}>{p.phone || '—'}</td>
                          <td><span className={`staff-badge${p.payment_status === 'paid' ? ' staff-badge--active' : ''}`}>{p.payment_status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {selectedUsers.length > 0 && (
                <div style={{ marginTop: 16, padding: 12, background: '#0abfbc22', border: '1px solid #0abfbc', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 14, color: '#d4d4d8' }}>
                    ✉️ <strong>{selectedUsers.length}</strong> participant{selectedUsers.length !== 1 ? 's' : ''} will receive a check-in reminder email
                  </p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowRemindDialog(false)}>Cancel</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => void sendReminders()}
                disabled={participants.filter(p => !p.checked_in_at).length === 0}
              >
                {selectedUsers.length > 0 
                  ? `📧 Send to ${selectedUsers.length} Selected` 
                  : `📧 Send to All ${participants.filter(p => !p.checked_in_at).length} Non-Checked-In`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ParticipantsList({ tournamentId, participants, onChanged, onMsg }: {
  tournamentId: number;
  participants: StaffParticipant[];
  onChanged: () => void;
  onMsg: (m: string, type?: 'success' | 'error') => void;
}) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    let html5QrCode: any = null;
    let isStopped = false;

    if (showScanner && !scanning) {
      setScanning(true);
      // Dynamically import and initialize scanner
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        try {
          html5QrCode = new Html5Qrcode('qr-reader');
          
          html5QrCode.start(
            { facingMode: 'environment' }, // Use back camera
            {
              fps: 10,
              qrbox: { width: 250, height: 250 }
            },
            async (decodedText: string) => {
              // QR code scanned successfully - stop scanner first
              if (html5QrCode && !isStopped) {
                isStopped = true;
                await html5QrCode.stop().catch(() => {});
              }
              setShowScanner(false);
              setScanning(false);
              setCode(decodedText);
              // Now perform check-in
              await checkIn({ code: decodedText });
            },
            () => {
              // Scan error (ignore, happens frequently during scanning)
            }
          ).catch((err: Error) => {
            onMsg(`Camera error: ${err.message}. Please allow camera access.`);
            setShowScanner(false);
            setScanning(false);
          });
        } catch (err) {
          onMsg('Failed to initialize scanner. Please try again.');
          setShowScanner(false);
          setScanning(false);
        }
      }).catch((err) => {
        onMsg('Failed to load scanner library.');
        setShowScanner(false);
        setScanning(false);
      });
    }

    return () => {
      if (html5QrCode && !isStopped) {
        isStopped = true;
        // Only try to stop if we haven't already stopped it
        html5QrCode.stop().catch(() => {
          // Silently ignore errors when stopping (scanner may already be stopped)
        });
        setScanning(false);
      }
    };
  }, [showScanner]);

  async function checkIn(payload: { code?: string; user_id?: number }) {
    setBusy(true);
    try {
      const res = await ccApi.checkInParticipant(tournamentId, payload);
      onMsg(res.message, 'success');
      setCode('');
      onChanged();
    } catch (e) { 
      onMsg(e instanceof ApiError ? e.message : 'Check-in failed', 'error'); 
    }
    finally { setBusy(false); }
  }

  const checkedIn = participants.filter((p) => p.checked_in_at).length;

  return (
    <div className="staff-section">
      <div className="staff-section__header">
        <h3 className="staff-h3">Participants ({participants.length})</h3>
        <span className="staff-badge staff-badge--active">{checkedIn} checked in</span>
      </div>

      <div className="staff-inline-form" style={{ marginBottom: 16 }}>
        <input
          id="checkin-code-input"
          className="auth-input" style={{ flex: 1 }}
          placeholder="Scan QR or type check-in code…"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && code.trim()) void checkIn({ code: code.trim() }); }}
        />
        <button type="button" className="btn btn-primary btn-sm" disabled={!code.trim() || busy}
          onClick={() => void checkIn({ code: code.trim() })}>
          Check in
        </button>
        <button 
          type="button" 
          className="btn btn-secondary btn-sm" 
          onClick={() => setShowScanner(!showScanner)}
        >
          {showScanner ? '✕ Close Scanner' : '📷 Show Scanner'}
        </button>
      </div>

      {/* QR Scanner */}
      {showScanner && (
        <div style={{ marginBottom: 16, padding: 16, background: '#0d1117', border: '1px solid #2a3544', borderRadius: 8 }}>
          <p style={{ marginBottom: 12, color: '#d4d4d8', textAlign: 'center' }}>
            Point your camera at the participant's QR code
          </p>
          <div id="qr-reader" style={{ width: '100%' }}></div>
        </div>
      )}

      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead><tr><th>Username</th><th>Name</th><th>Phone</th><th>Team</th><th>Payment</th><th>Check-in</th></tr></thead>
          <tbody>
            {participants.map((p) => (
              <tr key={p.user_id}>
                <td>@{p.username}</td>
                <td>{p.name}</td>
                <td>{p.phone || '—'}</td>
                <td>{p.team_name || '—'}</td>
                <td><span className={`staff-badge${p.payment_status === 'paid' ? ' staff-badge--active' : ''}`}>{p.payment_status}</span></td>
                <td>
                  {p.checked_in_at ? (
                    <span className="staff-badge staff-badge--active" title={p.checked_in_at}>✓ in</span>
                  ) : (
                    <button type="button" className="staff-action-btn" disabled={busy}
                      onClick={() => void checkIn({ user_id: p.user_id })}>
                      Check in
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function MatchList({ matches, onVerify, onEdit, onWalkover }: {
  matches: Match[];
  onVerify: (id: number) => void;
  onEdit: (id: number, data: object) => void;
  onWalkover: (id: number, side: 'A' | 'B') => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [editData, setEditData] = useState<Record<string, unknown>>({});
  const [scheduling, setScheduling] = useState<number | null>(null);
  const [newTime, setNewTime] = useState('');

  const totalRounds = matches.reduce((max, m) => Math.max(max, m.round_number), 0);
  const sorted = [...matches].sort((a, b) =>
    a.round_number - b.round_number || a.bracket_position - b.bracket_position || a.id - b.id);

  const sideOf = (m: Match, side: string) =>
    m.participants.filter((p) => p.team === side).map((p) => `#${p.user_id}`).join(', ');

  async function saveSchedule(m: Match) {
    if (!newTime) { setScheduling(null); return; }
    // datetime-local → ISO with local offset (matches backend string convention)
    const d = new Date(newTime);
    const off = -d.getTimezoneOffset();
    const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
    const p = (n: number) => String(n).padStart(2, '0');
    const iso = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:00${off >= 0 ? '+' : '-'}${pad(Math.trunc(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
    onEdit(m.id, { scheduled_at: iso });
    setScheduling(null);
    setNewTime('');
  }

  return (
    <div className="staff-section">
      <h3 className="staff-h3">Matches ({matches.length})</h3>
      {matches.length === 0 ? <p className="muted">No matches yet — generate the bracket from the Super Admin portal, or record one manually.</p> : sorted.map((m) => (
        <div key={m.id} className="staff-card">
          <div className="staff-card__header">
            <div>
              {m.round_number > 0 ? (
                <p className="staff-card__title" style={{ fontSize: 15 }}>
                  {roundLabel(m, totalRounds)}{m.is_bye ? ' · BYE' : ''}
                </p>
              ) : null}
              <p className="staff-card__meta">{m.match_type} · {m.game_mode} · {m.participants.length} players</p>
              {m.round_number > 0 ? (
                <p className="staff-card__meta muted small">
                  A: {sideOf(m, 'A') || 'TBD'} vs B: {sideOf(m, 'B') || 'TBD'}
                </p>
              ) : null}
              {m.scheduled_at ? <p className="staff-card__meta muted small">🗓 {m.scheduled_at.replace('T', ' ').slice(0, 17)}</p> : null}
            </div>
            <div className="staff-card__badges">
              <span className={`staff-badge${m.status === 'completed' ? ' staff-badge--active' : ''}`}>{m.status}</span>
            </div>
          </div>

          {/* Participants scores */}
          <div className="match-admin-scores">
            {m.participants.map((p) => (
              <div key={p.user_id} className="match-admin-score-row">
                <span className="match-admin-score-row__user">
                  {p.team !== 'none' ? `[${p.team}] ` : ''}User #{p.user_id}{p.role === 'captain' ? ' ©' : ''}
                </span>
                <span className="match-admin-score-row__result" style={{ color: p.result === 'win' ? '#4ade80' : p.result === 'loss' ? '#f87171' : '#fff' }}>
                  {p.result || '—'}
                </span>
                <span className="match-admin-score-row__pts">{p.points_earned} pts</span>
              </div>
            ))}
          </div>

          <div className="staff-card__actions">
            {m.status !== 'completed' && m.status !== 'cancelled' && (
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
                {m.round_number > 0 && !m.is_bye ? (
                  <>
                    <button type="button" className="staff-action-btn" onClick={() => onWalkover(m.id, 'A')}>
                      Walkover → A
                    </button>
                    <button type="button" className="staff-action-btn" onClick={() => onWalkover(m.id, 'B')}>
                      Walkover → B
                    </button>
                    <button type="button" className="staff-action-btn" onClick={() => { setScheduling(m.id); setNewTime(''); }}>
                      Schedule
                    </button>
                  </>
                ) : null}
              </>
            )}
          </div>

          {scheduling === m.id && (
            <div className="staff-inline-form">
              <input className="auth-input" type="datetime-local" value={newTime}
                onChange={(e) => setNewTime(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveSchedule(m)}>Save time</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setScheduling(null)}>Cancel</button>
            </div>
          )}

          {editing === m.id && (
            <div className="staff-edit-scores">
              <p className="staff-h3" style={{ marginBottom: 12 }}>Edit scores</p>
              {(editData.participants as typeof m.participants).map((p, i) => (
                <div key={p.user_id} className="staff-score-edit-row">
                  <span>{p.team !== 'none' ? `[${p.team}] ` : ''}User #{p.user_id}</span>
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
  participants: StaffParticipant[];
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
      played_at: new Date().toISOString().slice(0, 19) + 'Z',
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
      <p className="muted small" style={{ marginBottom: 12 }}>
        For friendlies / side matches. Bracket matches are created automatically by
        &ldquo;Generate bracket&rdquo; and advance on verification.
      </p>
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

// ── Tournament Management (Match Admin powers) ───────────────────────────────
function TournamentManagement({ tournament, onUpdate, onMsg }: {
  tournament: Tournament;
  onUpdate: () => void;
  onMsg: (m: string, type?: 'success' | 'error') => void;
}) {
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignUsername, setAssignUsername] = useState('');
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: tournament.name,
    min_participants: tournament.min_participants,
    max_participants: tournament.max_participants,
    prize_pool_inr: tournament.prize_pool_inr || 0,
    prize_description: tournament.prize_description || '',
    entry_fee_paise: tournament.entry_fee_paise || 0,
    description: tournament.description || '',
    rules: tournament.rules || '',
    registration_deadline: tournament.registration_deadline || '',
  });

  async function toggleRegistration() {
    try {
      await ccApi.updateTournament(tournament.id, { registration_open: !tournament.registration_open });
      onMsg(tournament.registration_open ? 'Registration closed.' : 'Registration opened.', 'success');
      onUpdate();
    } catch (e) {
      onMsg(e instanceof ApiError ? e.message : 'Failed to update registration', 'error');
    }
  }

  async function generateBracket() {
    if (!window.confirm(
      `Generate the knockout bracket for "${tournament.name}"?\n\n` +
      `This closes registration, sets the tournament LIVE, and notifies every participant. It cannot be re-run.`,
    )) return;
    setBusy(true);
    try {
      await ccApi.generateBracket(tournament.id);
      onMsg(`Bracket generated — "${tournament.name}" is live.`, 'success');
      onUpdate();
    } catch (e) {
      console.error('Generate bracket error:', e);
      // Extract the actual error message from ApiError
      const errorMsg = (e instanceof Error && e.message) ? e.message : 'Failed to generate bracket';
      onMsg(errorMsg, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function cancelEvent() {
    const reason = window.prompt(`Cancel "${tournament.name}"? Every registrant will be notified. Reason:`);
    if (reason === null) return;
    try {
      await ccApi.cancelTournament(tournament.id, reason);
      onMsg(`"${tournament.name}" cancelled.`, 'success');
      onUpdate();
    } catch (e) {
      onMsg(e instanceof ApiError ? e.message : 'Failed to cancel tournament', 'error');
    }
  }

  async function assignAdmin() {
    if (!assignUsername.trim()) return;
    try {
      await ccApi.assignMatchAdmin(tournament.id, assignUsername.trim());
      onMsg(`Assigned @${assignUsername} as match admin`, 'success');
      setAssigning(false);
      setAssignUsername('');
    } catch (e) {
      onMsg(e instanceof ApiError ? e.message : 'Failed to assign match admin', 'error');
    }
  }

  async function saveSettings() {
    try {
      await ccApi.updateTournament(tournament.id, {
        name: editForm.name,
        min_participants: editForm.min_participants,
        max_participants: editForm.max_participants,
        prize_pool_inr: editForm.prize_pool_inr,
        prize_description: editForm.prize_description,
        entry_fee_paise: editForm.entry_fee_paise,
        description: editForm.description,
        rules: editForm.rules,
        registration_deadline: editForm.registration_deadline,
      });
      onMsg('Tournament settings updated.', 'success');
      setEditing(false);
      onUpdate();
    } catch (e) {
      onMsg(e instanceof ApiError ? e.message : 'Failed to update tournament', 'error');
    }
  }

  return (
    <div className="staff-section">
      <h3 className="staff-h3">Tournament Management</h3>
      <p className="muted small" style={{ marginBottom: 20 }}>
        Manage tournament settings, registration, and bracket generation.
      </p>

      <div className="staff-card" style={{ marginBottom: 20 }}>
        <div className="staff-card__header">
          <div>
            <h3 className="staff-card__title">{tournament.name}</h3>
            <p className="staff-card__meta">
              {tournament.game} · {tournament.mode} · {tournament.participant_count}/{tournament.max_participants} players
              {tournament.entry_fee_paise === 0 ? ' · FREE' : ` · ₹${tournament.entry_fee_paise / 100}`}
              {tournament.awards_leaderboard_points ? ' · points ON' : ' · points OFF'}
            </p>
          </div>
          <span className="staff-badge">{tournament.status.replace('_', ' ')}</span>
        </div>

        <div className="staff-trn-actions" style={{ marginTop: 16 }}>
          {tournament.status === 'registration' && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void toggleRegistration()}
              >
                {tournament.registration_open ? 'Close registration' : 'Open registration'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={() => void generateBracket()}
              >
                {busy ? 'Generating…' : '⚔ Generate bracket'}
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setEditing(!editing)}
          >
            {editing ? 'Cancel edit' : '✏️ Edit settings'}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setAssigning(!assigning)}
          >
            {assigning ? 'Cancel' : 'Assign match admin'}
          </button>
          {tournament.status !== 'completed' && tournament.status !== 'cancelled' && (
            <button
              type="button"
              className="staff-action-btn staff-action-btn--danger"
              onClick={() => void cancelEvent()}
            >
              Cancel event
            </button>
          )}
        </div>

        {editing && (
          <div className="staff-card" style={{ marginTop: 16, background: '#0a0f1a' }}>
            <h4 className="staff-h3" style={{ marginBottom: 16 }}>Edit Tournament Settings</h4>
            
            <div className="auth-field" style={{ marginBottom: 16 }}>
              <label className="auth-label">Tournament Name</label>
              <input
                type="text"
                className="auth-input"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="auth-field">
                <label className="auth-label">Minimum Participants</label>
                <input
                  type="number"
                  className="auth-input"
                  value={editForm.min_participants}
                  onChange={(e) => setEditForm({ ...editForm, min_participants: Number(e.target.value) })}
                  min={0}
                />
                <p className="muted small" style={{ marginTop: 4 }}>
                  Set to 0 to disable minimum requirement
                </p>
              </div>
              <div className="auth-field">
                <label className="auth-label">Maximum Participants</label>
                <input
                  type="number"
                  className="auth-input"
                  value={editForm.max_participants}
                  onChange={(e) => setEditForm({ ...editForm, max_participants: Number(e.target.value) })}
                  min={2}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              <div className="auth-field">
                <label className="auth-label">Entry Fee (₹)</label>
                <input
                  type="number"
                  className="auth-input"
                  value={editForm.entry_fee_paise / 100}
                  onChange={(e) => setEditForm({ ...editForm, entry_fee_paise: Math.round(Number(e.target.value) * 100) })}
                  min={0}
                  step={1}
                />
              </div>
              <div className="auth-field">
                <label className="auth-label">Prize Pool (₹)</label>
                <input
                  type="number"
                  className="auth-input"
                  value={editForm.prize_pool_inr}
                  onChange={(e) => setEditForm({ ...editForm, prize_pool_inr: Number(e.target.value) })}
                  min={0}
                />
              </div>
            </div>

            <div className="auth-field" style={{ marginBottom: 16 }}>
              <label className="auth-label">Prize Description</label>
              <input
                type="text"
                className="auth-input"
                value={editForm.prize_description}
                onChange={(e) => setEditForm({ ...editForm, prize_description: e.target.value })}
                placeholder="e.g., Trophies for top 3, Gift cards"
              />
            </div>

            <div className="auth-field" style={{ marginBottom: 16 }}>
              <label className="auth-label">Registration Deadline</label>
              <input
                type="datetime-local"
                className="auth-input"
                value={editForm.registration_deadline ? new Date(editForm.registration_deadline).toISOString().slice(0, 16) : ''}
                onChange={(e) => setEditForm({ ...editForm, registration_deadline: e.target.value ? new Date(e.target.value).toISOString() : '' })}
              />
            </div>

            <div className="auth-field" style={{ marginBottom: 16 }}>
              <label className="auth-label">Description</label>
              <textarea
                className="auth-input"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={4}
                placeholder="Tell players what to expect from this tournament..."
              />
            </div>

            <div className="auth-field" style={{ marginBottom: 16 }}>
              <label className="auth-label">Rules</label>
              <textarea
                className="auth-input"
                value={editForm.rules}
                onChange={(e) => setEditForm({ ...editForm, rules: e.target.value })}
                rows={4}
                placeholder="Tournament rules, format, scoring system..."
              />
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void saveSettings()}>
                Save changes
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {assigning && (
          <div className="staff-inline-form" style={{ marginTop: 16 }}>
            <input
              className="auth-input"
              placeholder="@username"
              value={assignUsername}
              onChange={(e) => setAssignUsername(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void assignAdmin()}>
              Assign
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAssigning(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="staff-card">
        <h4 className="staff-h3">Tournament Details</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 12 }}>
          <div>
            <p className="muted small" style={{ marginBottom: 4 }}>Registration Status</p>
            <p style={{ margin: 0 }}>{tournament.registration_open ? '✅ Open' : '🚫 Closed'}</p>
          </div>
          <div>
            <p className="muted small" style={{ marginBottom: 4 }}>Participants</p>
            <p style={{ margin: 0 }}>
              {tournament.participant_count} / {tournament.max_participants}
              {tournament.min_participants > 0 && (
                <span className="muted small"> (min: {tournament.min_participants})</span>
              )}
            </p>
          </div>
          <div>
            <p className="muted small" style={{ marginBottom: 4 }}>Entry Fee</p>
            <p style={{ margin: 0 }}>{tournament.entry_fee_paise === 0 ? 'FREE' : `₹${tournament.entry_fee_paise / 100}`}</p>
          </div>
          <div>
            <p className="muted small" style={{ marginBottom: 4 }}>Prize Pool</p>
            <p style={{ margin: 0 }}>₹{tournament.prize_pool_paise / 100}</p>
          </div>
          <div>
            <p className="muted small" style={{ marginBottom: 4 }}>Format</p>
            <p style={{ margin: 0 }}>{tournament.format}</p>
          </div>
          <div>
            <p className="muted small" style={{ marginBottom: 4 }}>Starts At</p>
            <p style={{ margin: 0 }}>{new Date(tournament.starts_at).toLocaleDateString()}</p>
          </div>
        </div>
      </div>
    </div>
  );
}


// ── Groups Management ─────────────────────────────────────────────────────────
type GroupStanding = {
  user_id: number;
  username: string;
  name: string;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  matches_played: number;
  position: number;
  advanced_to_knockout: boolean;
};

type GroupData = {
  group_name: string;
  group_id: number;
  standings: GroupStanding[];
};

function GroupsManagement({ tournament, onUpdate, onMsg }: {
  tournament: Tournament;
  onUpdate: () => void;
  onMsg: (m: string, type?: 'success' | 'error') => void;
}) {
  const [groups, setGroups] = useState<GroupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showGenerateForm, setShowGenerateForm] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    num_groups: 2,
    advance_per_group: 2,
    points_win: 3,
    points_draw: 1,
    points_loss: 0,
  });

  useEffect(() => {
    loadGroups();
  }, [tournament.id]);

  async function loadGroups() {
    try {
      const data = await staffReq<GroupData[]>(`/api/admin/tournaments/${tournament.id}/groups`);
      setGroups(data);
    } catch (e) {
      // Groups might not exist yet
      setGroups([]);
    } finally {
      setLoading(false);
    }
  }

  async function generateGroups() {
    if (!window.confirm(
      `Generate ${generateForm.num_groups} groups with round-robin matches?\n\n` +
      `Top ${generateForm.advance_per_group} from each group will advance to knockout.`
    )) return;

    setGenerating(true);
    try {
      const res = await staffReq<{ message: string; groups: Array<{ id: number; name: string }>; total_matches: number }>(
        `/api/admin/tournaments/${tournament.id}/generate-groups`,
        {
          method: 'POST',
          body: JSON.stringify(generateForm),
        }
      );
      onMsg(`${res.message} — ${res.total_matches} matches created`, 'success');
      setShowGenerateForm(false);
      await loadGroups();
      onUpdate();
    } catch (e) {
      onMsg(e instanceof ApiError ? e.message : 'Failed to generate groups', 'error');
    } finally {
      setGenerating(false);
    }
  }

  async function completeGroupStage() {
    if (!window.confirm(
      `Complete the group stage and generate knockout bracket?\n\n` +
      `This will:\n` +
      `- Verify all group matches are completed\n` +
      `- Finalize group standings\n` +
      `- Advance top ${generateForm.advance_per_group} from each group\n` +
      `- Generate knockout bracket\n\n` +
      `This action cannot be undone.`
    )) return;

    setCompleting(true);
    try {
      const res = await staffReq<{ message: string; phase: string }>(
        `/api/admin/tournaments/${tournament.id}/complete-group-stage`,
        { method: 'POST' }
      );
      onMsg(res.message, 'success');
      await loadGroups();
      onUpdate();
    } catch (e) {
      onMsg(e instanceof ApiError ? e.message : 'Failed to complete group stage', 'error');
    } finally {
      setCompleting(false);
    }
  }

  // Check if tournament supports groups
  const supportsGroups = tournament.format === 'groups_knockout' || tournament.format === 'round_robin';

  if (!supportsGroups) {
    return (
      <div className="staff-section">
        <h3 className="staff-h3">Groups</h3>
        <div className="staff-card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">This tournament format does not use groups.</p>
          <p className="muted small" style={{ marginTop: 8 }}>
            Tournament format: <strong>{tournament.format}</strong>
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="staff-section">
        <h3 className="staff-h3">Groups</h3>
        <p className="muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="staff-section">
      <div className="staff-section__header">
        <h3 className="staff-h3">Groups</h3>
        {groups.length === 0 && tournament.status === 'registration' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowGenerateForm(!showGenerateForm)}
          >
            {showGenerateForm ? 'Cancel' : '➕ Generate Groups'}
          </button>
        )}
        {groups.length > 0 && tournament.status === 'live' && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={completing}
            onClick={() => void completeGroupStage()}
          >
            {completing ? 'Completing...' : '✅ Complete Group Stage'}
          </button>
        )}
      </div>

      {showGenerateForm && (
        <div className="staff-card" style={{ marginBottom: 20, background: '#0a0f1a' }}>
          <h4 className="staff-h3" style={{ marginBottom: 16 }}>Group Configuration</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <div className="auth-field">
              <label className="auth-label">Number of Groups</label>
              <input
                type="number"
                className="auth-input"
                value={generateForm.num_groups}
                onChange={(e) => setGenerateForm({ ...generateForm, num_groups: Number(e.target.value) })}
                min={1}
                max={8}
              />
              <p className="muted small" style={{ marginTop: 4 }}>
                Participants: {tournament.participant_count} → {Math.floor(tournament.participant_count / generateForm.num_groups)} per group
              </p>
            </div>
            <div className="auth-field">
              <label className="auth-label">Advance Per Group</label>
              <input
                type="number"
                className="auth-input"
                value={generateForm.advance_per_group}
                onChange={(e) => setGenerateForm({ ...generateForm, advance_per_group: Number(e.target.value) })}
                min={1}
                max={8}
              />
              <p className="muted small" style={{ marginTop: 4 }}>
                Total advancing: {generateForm.num_groups * generateForm.advance_per_group}
              </p>
            </div>
            <div className="auth-field">
              <label className="auth-label">Points for Win</label>
              <input
                type="number"
                className="auth-input"
                value={generateForm.points_win}
                onChange={(e) => setGenerateForm({ ...generateForm, points_win: Number(e.target.value) })}
                min={0}
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Points for Draw</label>
              <input
                type="number"
                className="auth-input"
                value={generateForm.points_draw}
                onChange={(e) => setGenerateForm({ ...generateForm, points_draw: Number(e.target.value) })}
                min={0}
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Points for Loss</label>
              <input
                type="number"
                className="auth-input"
                value={generateForm.points_loss}
                onChange={(e) => setGenerateForm({ ...generateForm, points_loss: Number(e.target.value) })}
                min={0}
              />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={generating}
              onClick={() => void generateGroups()}
            >
              {generating ? 'Generating...' : '⚔ Generate Groups'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowGenerateForm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {groups.length === 0 ? (
        <div className="staff-card" style={{ textAlign: 'center', padding: 40 }}>
          <p className="muted">No groups generated yet.</p>
          <p className="muted small" style={{ marginTop: 8 }}>
            Generate groups to create round-robin matches within each group.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: 20 }}>
          {groups.map((group) => (
            <div key={group.group_id} className="staff-card">
              <h4 className="staff-h3" style={{ marginBottom: 16 }}>
                Group {group.group_name}
              </h4>
              <div className="staff-table-wrap">
                <table className="staff-table" style={{ fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}>Pos</th>
                      <th>Player</th>
                      <th style={{ width: 50, textAlign: 'center' }}>Pts</th>
                      <th style={{ width: 40, textAlign: 'center' }}>W</th>
                      <th style={{ width: 40, textAlign: 'center' }}>D</th>
                      <th style={{ width: 40, textAlign: 'center' }}>L</th>
                      <th style={{ width: 50, textAlign: 'center' }}>GD</th>
                      <th style={{ width: 50, textAlign: 'center' }}>MP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.standings.map((standing) => (
                      <tr
                        key={standing.user_id}
                        style={{
                          background: standing.advanced_to_knockout ? '#0abfbc11' : 'transparent',
                          fontWeight: standing.advanced_to_knockout ? 600 : 400,
                        }}
                      >
                        <td>{standing.position}</td>
                        <td>
                          @{standing.username}
                          {standing.advanced_to_knockout && (
                            <span style={{ marginLeft: 6, color: '#0abfbc', fontSize: 11 }}>✓ ADV</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{standing.points}</td>
                        <td style={{ textAlign: 'center', color: '#4ade80' }}>{standing.wins}</td>
                        <td style={{ textAlign: 'center', color: '#fbbf24' }}>{standing.draws}</td>
                        <td style={{ textAlign: 'center', color: '#f87171' }}>{standing.losses}</td>
                        <td style={{ textAlign: 'center' }}>
                          {standing.goal_difference > 0 ? '+' : ''}{standing.goal_difference}
                        </td>
                        <td style={{ textAlign: 'center' }}>{standing.matches_played}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="muted small" style={{ marginTop: 12, textAlign: 'center' }}>
                Pts = Points, W = Wins, D = Draws, L = Losses, GD = Goal Difference, MP = Matches Played
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
