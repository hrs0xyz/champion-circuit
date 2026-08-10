/**
 * Match Admin Portal — /staff/match
 * For users assigned as match admin to a tournament.
 * They can: view participants, check players in, record matches, edit scores,
 * schedule bracket matches, verify results (auto-advances the bracket) and
 * resolve no-shows with walkovers.
 */
import { useEffect, useState, useRef, type FormEvent } from 'react';
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
  const [showBracketDialog, setShowBracketDialog] = useState(false);
  const [formatSuggestions, setFormatSuggestions] = useState<any>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [participantSeeds, setParticipantSeeds] = useState<Array<{user_id: number; username: string; seed: number}>>([]);

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

  async function openBracketGenerator() {
    if (!selected) return;
    try {
      const suggestions = await ccApi.getFormatSuggestions(selected.id);
      setFormatSuggestions(suggestions);
      
      // Pre-select recommended format
      const recommended = suggestions.suggestions.find((s: any) => s.recommended);
      if (recommended) {
        setSelectedFormat(recommended.format);
      }
      
      // Prepare participant seeding list (checked-in only)
      const checkedIn = participants.filter(p => p.checked_in_at);
      const seeds = checkedIn.map((p, index) => ({
        user_id: p.user_id,
        username: p.username,
        seed: index + 1, // Default sequential seeding
      }));
      setParticipantSeeds(seeds);
      
      setShowBracketDialog(true);
      setShowAdvanced(false);
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Failed to load format suggestions');
    }
  }

  async function generateBracketWithFormat() {
    if (!selected || !selectedFormat) return;
    try {
      setBusy(true);
      const hasExistingMatches = matches.length > 0;
      
      if (hasExistingMatches) {
        // Regenerate
        await ccApi.regenerateBracket(selected.id, { format: selectedFormat });
        setMsg('Bracket regenerated successfully!');
      } else {
        // First time generation - pass the selected format
        await ccApi.generateBracket(selected.id, { format: selectedFormat });
        setMsg('Bracket generated successfully!');
      }
      
      await refreshData(selected);
      setShowBracketDialog(false);
      setTab('matches');
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Failed to generate bracket');
      setMsgType('error');
    } finally {
      setBusy(false);
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
            {tab === 'matches' && <MatchList matches={matches} participants={participants} onVerify={async (id) => {
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
                matches={matches}
                participants={participants}
                onOpenBracketGenerator={() => void openBracketGenerator()}
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

      {/* Bracket Generation Dialog */}
      {showBracketDialog && selected && formatSuggestions && (
        <div className="modal-overlay" onClick={() => setShowBracketDialog(false)}>
          <div className="modal-content" style={{ maxWidth: 900 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {matches.length > 0 ? '🔄 Regenerate Tournament Bracket' : '⚔ Generate Tournament Bracket'}
              </h2>
              <button type="button" className="modal-close" onClick={() => setShowBracketDialog(false)}>×</button>
            </div>
            <div className="modal-body">
              {matches.length > 0 && (
                <div style={{ marginBottom: 24, padding: 16, background: '#dc262622', border: '1px solid #dc2626', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 14, color: '#fca5a5', lineHeight: 1.6 }}>
                    ⚠️ <strong>Warning:</strong> Regenerating will delete all existing matches and teams. This action cannot be undone. Only do this if you need to start over with a different format.
                  </p>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <p style={{ color: '#d4d4d8', marginBottom: 8 }}>
                  <strong>{formatSuggestions.checked_in_count}</strong> participants have checked in
                </p>
                <p style={{ color: '#9ca3af', fontSize: 14, marginBottom: 20 }}>
                  Select the tournament format that works best for your event:
                </p>
              </div>

              {/* Format Cards */}
              <div style={{ display: 'grid', gap: 16, marginBottom: 24 }}>
                {formatSuggestions.suggestions.map((suggestion: any) => {
                  // Determine if format is disabled (not_enough or not feasible)
                  const isDisabled = suggestion.format === 'not_enough' || suggestion.total_matches === 0;
                  const disabledReason = suggestion.format === 'not_enough' 
                    ? 'Need at least 3 checked-in participants'
                    : suggestion.cons[0] || 'Not feasible for current participant count';
                  
                  return (
                    <div
                      key={suggestion.format}
                      onClick={() => !isDisabled && setSelectedFormat(suggestion.format)}
                      style={{
                        padding: 20,
                        background: isDisabled 
                          ? '#18181b' 
                          : selectedFormat === suggestion.format ? '#0abfbc22' : '#0d1117',
                        border: `2px solid ${
                          isDisabled 
                            ? '#3f3f46'
                            : selectedFormat === suggestion.format ? '#0abfbc' : '#2a3544'
                        }`,
                        borderRadius: 12,
                        cursor: isDisabled ? 'not-allowed' : 'pointer',
                        opacity: isDisabled ? 0.5 : 1,
                        transition: 'all 0.2s',
                        position: 'relative',
                      }}
                    >
                      {isDisabled && (
                        <div style={{
                          position: 'absolute',
                          top: 12,
                          right: 12,
                          padding: '4px 12px',
                          background: '#ef4444',
                          color: '#fff',
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 4,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                        }}>
                          Not Available
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: isDisabled ? '#71717a' : '#fff' }}>
                              {suggestion.name}
                            </h3>
                            {suggestion.recommended && !isDisabled && (
                              <span style={{
                                padding: '2px 8px',
                                background: '#0abfbc',
                                color: '#000',
                                fontSize: 11,
                                fontWeight: 700,
                                borderRadius: 4,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px'
                              }}>
                                Recommended
                              </span>
                            )}
                          </div>
                          <p style={{ margin: '0 0 12px 0', color: isDisabled ? '#71717a' : '#9ca3af', fontSize: 14 }}>
                            {suggestion.description}
                          </p>
                          {isDisabled ? (
                            <p style={{ margin: 0, color: '#ef4444', fontSize: 13, fontWeight: 500 }}>
                              ⚠️ {disabledReason}
                            </p>
                          ) : (
                            <p style={{ margin: 0, color: '#0abfbc', fontSize: 13, fontWeight: 500 }}>
                              📊 {suggestion.total_matches} total matches
                            </p>
                          )}
                        </div>
                        {!isDisabled && (
                          <div style={{
                            width: 24,
                            height: 24,
                            borderRadius: '50%',
                            border: `2px solid ${selectedFormat === suggestion.format ? '#0abfbc' : '#6b7280'}`,
                            background: selectedFormat === suggestion.format ? '#0abfbc' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            marginLeft: 16,
                          }}>
                            {selectedFormat === suggestion.format && (
                              <span style={{ color: '#000', fontSize: 14, fontWeight: 900 }}>✓</span>
                            )}
                          </div>
                        )}
                      </div>

                      {!isDisabled && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div>
                            <p style={{ margin: '0 0 6px 0', fontSize: 12, fontWeight: 600, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Pros
                            </p>
                            <ul style={{ margin: 0, paddingLeft: 20, color: '#d4d4d8', fontSize: 13, lineHeight: 1.8 }}>
                              {suggestion.pros.map((pro: string, i: number) => (
                                <li key={i}>{pro}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p style={{ margin: '0 0 6px 0', fontSize: 12, fontWeight: 600, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Cons
                            </p>
                            <ul style={{ margin: 0, paddingLeft: 20, color: '#d4d4d8', fontSize: 13, lineHeight: 1.8 }}>
                              {suggestion.cons.map((con: string, i: number) => (
                                <li key={i}>{con}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {selectedFormat && (
                <div style={{ padding: 16, background: '#0abfbc11', border: '1px solid #0abfbc', borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 14, color: '#d4d4d8' }}>
                    ✓ Format selected: <strong style={{ color: '#0abfbc' }}>
                      {formatSuggestions.suggestions.find((s: any) => s.format === selectedFormat)?.name}
                    </strong>
                  </p>
                </div>
              )}

              {/* Advanced Options Toggle */}
              {selectedFormat && (
                <div style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    style={{ width: '100%' }}
                  >
                    {showAdvanced ? '▼ Hide Advanced Options' : '▶ Show Advanced Options (Seeding & Preview)'}
                  </button>
                </div>
              )}

              {/* Advanced Seeding Interface */}
              {showAdvanced && selectedFormat && (
                <div style={{ marginTop: 16, padding: 20, background: '#0d1117', border: '1px solid #2a3544', borderRadius: 8 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: '#fff' }}>
                    🎯 Manual Seeding
                  </h4>
                  <p style={{ margin: '0 0 16px 0', color: '#9ca3af', fontSize: 13 }}>
                    Adjust the seeding order for participants. Higher seeds (1, 2, 3...) get favorable bracket positions.
                  </p>

                  {/* Seeding Controls */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        // Reset to default sequential order
                        const sorted = [...participantSeeds].map((p, i) => ({ ...p, seed: i + 1 }));
                        setParticipantSeeds(sorted);
                      }}
                    >
                      ↻ Reset Order
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        // Randomize seeds
                        const shuffled = [...participantSeeds]
                          .sort(() => Math.random() - 0.5)
                          .map((p, i) => ({ ...p, seed: i + 1 }));
                        setParticipantSeeds(shuffled);
                      }}
                    >
                      🎲 Randomize
                    </button>
                  </div>

                  {/* Participant List with Seeding */}
                  <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #2a3544', borderRadius: 8 }}>
                    <table className="staff-table" style={{ marginBottom: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: 80 }}>Seed</th>
                          <th>Username</th>
                          <th style={{ width: 120 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...participantSeeds].sort((a, b) => a.seed - b.seed).map((p, index) => (
                          <tr key={p.user_id}>
                            <td>
                              <input
                                type="number"
                                min="1"
                                max={participantSeeds.length}
                                value={p.seed}
                                onChange={(e) => {
                                  const newSeed = parseInt(e.target.value) || 1;
                                  const updated = participantSeeds.map(participant => {
                                    if (participant.user_id === p.user_id) {
                                      return { ...participant, seed: newSeed };
                                    }
                                    return participant;
                                  });
                                  setParticipantSeeds(updated);
                                }}
                                style={{
                                  width: '60px',
                                  padding: '4px 8px',
                                  background: '#1a1f2e',
                                  border: '1px solid #2d3748',
                                  borderRadius: '4px',
                                  color: 'white',
                                  fontSize: '14px',
                                }}
                              />
                            </td>
                            <td>@{p.username}</td>
                            <td>
                              <div style={{ display: 'flex', gap: 4 }}>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  disabled={index === 0}
                                  onClick={() => {
                                    // Move up
                                    const sorted = [...participantSeeds].sort((a, b) => a.seed - b.seed);
                                    if (index > 0) {
                                      const temp = sorted[index].seed;
                                      sorted[index].seed = sorted[index - 1].seed;
                                      sorted[index - 1].seed = temp;
                                      setParticipantSeeds(sorted);
                                    }
                                  }}
                                  style={{ padding: '2px 8px', fontSize: '12px' }}
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  disabled={index === participantSeeds.length - 1}
                                  onClick={() => {
                                    // Move down
                                    const sorted = [...participantSeeds].sort((a, b) => a.seed - b.seed);
                                    if (index < sorted.length - 1) {
                                      const temp = sorted[index].seed;
                                      sorted[index].seed = sorted[index + 1].seed;
                                      sorted[index + 1].seed = temp;
                                      setParticipantSeeds(sorted);
                                    }
                                  }}
                                  style={{ padding: '2px 8px', fontSize: '12px' }}
                                >
                                  ▼
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Bracket Preview */}
                  <div style={{ marginTop: 20 }}>
                    <h4 style={{ margin: '0 0 12px 0', fontSize: 16, fontWeight: 600, color: '#fff' }}>
                      👁️ Bracket Preview
                    </h4>
                    <div style={{ padding: 16, background: '#1a1f2e', border: '1px solid #2a3544', borderRadius: 8 }}>
                      {selectedFormat === 'knockout' && (
                        <div>
                          <p style={{ margin: '0 0 12px 0', color: '#0abfbc', fontSize: 14, fontWeight: 500 }}>
                            Single Elimination Bracket
                          </p>
                          <div style={{ display: 'grid', gap: 8, fontSize: 13, color: '#d4d4d8' }}>
                            {(() => {
                              const sorted = [...participantSeeds].sort((a, b) => a.seed - b.seed);
                              const rounds = Math.ceil(Math.log2(sorted.length));
                              return (
                                <div>
                                  <p style={{ marginBottom: 8, color: '#9ca3af' }}>
                                    <strong>Round 1 Matchups:</strong>
                                  </p>
                                  {sorted.slice(0, Math.min(4, sorted.length)).map((p, i) => {
                                    if (i % 2 === 0 && i + 1 < sorted.length) {
                                      return (
                                        <div key={i} style={{ padding: '8px', background: '#0d1117', borderRadius: '4px', marginBottom: '4px' }}>
                                          Seed #{p.seed} @{p.username} <strong>vs</strong> Seed #{sorted[i + 1].seed} @{sorted[i + 1].username}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })}
                                  {sorted.length > 4 && (
                                    <p style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>
                                      ... and {Math.floor(sorted.length / 2) - 2} more matches
                                    </p>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                      {selectedFormat === 'group_knockout' && (
                        <div>
                          <p style={{ margin: '0 0 12px 0', color: '#0abfbc', fontSize: 14, fontWeight: 500 }}>
                            Group Stage + Knockout
                          </p>
                          <p style={{ margin: 0, color: '#9ca3af', fontSize: 13 }}>
                            Groups will be created with balanced seeding. Top performers advance to knockout rounds.
                          </p>
                        </div>
                      )}
                      {selectedFormat === 'round_robin' && (
                        <div>
                          <p style={{ margin: '0 0 12px 0', color: '#0abfbc', fontSize: 14, fontWeight: 500 }}>
                            Round Robin Format
                          </p>
                          <p style={{ margin: 0, color: '#9ca3af', fontSize: 13 }}>
                            Everyone plays everyone once. {(participantSeeds.length * (participantSeeds.length - 1)) / 2} total matches.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setShowBracketDialog(false)}>
                Cancel
              </button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => void generateBracketWithFormat()}
                disabled={!selectedFormat || busy}
              >
                {busy ? 'Generating...' : matches.length > 0 ? '🔄 Regenerate Bracket' : '⚔ Generate Bracket'}
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

function MatchList({ matches, participants, onVerify, onEdit, onWalkover }: {
  matches: Match[];
  participants: StaffParticipant[];
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

  const sideOf = (m: Match, side: string) => {
    const userIds = m.participants.filter((p) => p.team === side).map((p) => p.user_id);
    return userIds.map(uid => {
      const participant = participants.find(p => p.user_id === uid);
      return participant ? `@${participant.username}` : `#${uid}`;
    }).join(', ');
  };

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
function TournamentManagement({ tournament, matches, participants, onOpenBracketGenerator, onUpdate, onMsg }: {
  tournament: Tournament;
  matches: Match[];
  participants: StaffParticipant[];
  onOpenBracketGenerator: () => void;
  onUpdate: () => void;
  onMsg: (m: string, type?: 'success' | 'error') => void;
}) {
  const [busy, setBusy] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignUsername, setAssignUsername] = useState('');
  const [editing, setEditing] = useState(false);
  const [showAdmins, setShowAdmins] = useState(false);
  const [admins, setAdmins] = useState<Array<{ user_id: number; username: string; name: string }>>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  
  // Draft = everything editable, Live = only specific fields
  const isDraft = tournament.status === 'draft' || tournament.status === 'pending_approval';
  
  const [editForm, setEditForm] = useState({
    name: tournament.name,
    game: tournament.game,
    mode: tournament.mode,
    min_participants: tournament.min_participants,
    max_participants: tournament.max_participants,
    prize_pool_inr: tournament.prize_pool_inr || 0,
    prize_description: tournament.prize_description || '',
    entry_fee_paise: tournament.entry_fee_paise || 0,
    description: tournament.description || '',
    rules: tournament.rules || '',
    registration_deadline: tournament.registration_deadline || '',
    starts_at: tournament.starts_at || '',
    ends_at: tournament.ends_at || '',
    banner_url: tournament.banner_url || '',
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
      if (showAdmins) {
        await loadAdmins();
      }
    } catch (e) {
      onMsg(e instanceof ApiError ? e.message : 'Failed to assign match admin', 'error');
    }
  }

  async function loadAdmins() {
    setLoadingAdmins(true);
    try {
      const data = await ccApi.listTournamentAdmins(tournament.id);
      setAdmins(data);
    } catch (e) {
      onMsg(e instanceof ApiError ? e.message : 'Failed to load admins', 'error');
    } finally {
      setLoadingAdmins(false);
    }
  }

  async function removeAdmin(userId: number, username: string) {
    if (!window.confirm(`Remove @${username} as match admin?`)) return;
    try {
      await ccApi.removeMatchAdmin(tournament.id, userId);
      onMsg(`Removed @${username} as match admin`, 'success');
      await loadAdmins();
    } catch (e) {
      onMsg(e instanceof ApiError ? e.message : 'Failed to remove match admin', 'error');
    }
  }

  async function toggleAdminsList() {
    const newState = !showAdmins;
    setShowAdmins(newState);
    if (newState) {
      await loadAdmins();
    }
  }

  async function saveSettings() {
    try {
      const payload: any = {};
      
      if (isDraft) {
        // Draft mode: send all editable fields
        payload.name = editForm.name;
        payload.game = editForm.game;
        payload.mode = editForm.mode;
        payload.min_participants = editForm.min_participants;
        payload.max_participants = editForm.max_participants;
        payload.entry_fee_paise = 0; // Always FREE - paid tournaments not supported yet
        payload.prize_pool_inr = editForm.prize_pool_inr;
        payload.prize_description = editForm.prize_description;
        payload.registration_deadline = editForm.registration_deadline;
        payload.starts_at = editForm.starts_at;
        payload.ends_at = editForm.ends_at;
        payload.banner_url = editForm.banner_url;
        payload.description = editForm.description;
        payload.rules = editForm.rules;
      } else {
        // Live mode: ONLY min/max participants for match admins
        // Backend will reject anything else for non-super-admins
        payload.min_participants = editForm.min_participants;
        payload.max_participants = editForm.max_participants;
      }
      
      await ccApi.updateTournament(tournament.id, payload);
      onMsg('Tournament settings updated.', 'success');
      setEditing(false);
      onUpdate();
    } catch (e) {
      onMsg(e instanceof ApiError ? e.message : 'Failed to update tournament', 'error');
    }
  }

  async function handleBannerUpload(file: File) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      onMsg('Please upload a JPG, PNG, or WebP image', 'error');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      onMsg('Image must be 3MB or smaller', 'error');
      return;
    }

    setUploadingBanner(true);
    try {
      const token = localStorage.getItem('cc_token');
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${BASE}/api/uploads/tournament-banner`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Upload failed');
      }

      const result = await response.json() as { url: string };
      setEditForm({ ...editForm, banner_url: result.url });
      onMsg('Banner uploaded successfully', 'success');
    } catch (err) {
      onMsg(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
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
          <span className={`staff-badge${tournament.status === 'live' || tournament.status === 'registration' ? ' staff-badge--active' : ''}`}>
            {tournament.status.replace('_', ' ')}
          </span>
        </div>

        {/* Tournament Status Explanation */}
        <div style={{ marginTop: 16, padding: 12, background: '#0d1117', borderRadius: 8, fontSize: 14 }}>
          <p style={{ margin: 0, color: '#9ca3af' }}>
            <strong style={{ color: '#0abfbc' }}>Current Status:</strong>{' '}
            {tournament.status === 'draft' && 'Tournament is in draft mode. Submit for approval when ready.'}
            {tournament.status === 'pending_approval' && 'Waiting for admin approval. You can still edit while pending.'}
            {tournament.status === 'registration' && `Registration is ${tournament.registration_open ? 'OPEN' : 'CLOSED'}. ${participants.filter(p => p.checked_in_at).length} participants checked in. Generate bracket to start matches.`}
            {tournament.status === 'live' && 'Tournament is LIVE! Matches are in progress.'}
            {tournament.status === 'completed' && 'Tournament has ended.'}
            {tournament.status === 'cancelled' && 'Tournament was cancelled.'}
          </p>
        </div>

        {/* Tournament Details Grid */}
        <div style={{ marginTop: 20, display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, padding: 16, background: '#0a0f1a', borderRadius: 8 }}>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Registration Status</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: tournament.registration_open ? '#10b981' : '#ef4444' }}>
              {tournament.registration_open ? '🟢 Open' : '🔴 Closed'}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Participants</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
              {tournament.participant_count} / {tournament.max_participants} {participants.filter(p => p.checked_in_at).length > 0 && `(${participants.filter(p => p.checked_in_at).length} checked in)`}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Entry Fee</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#10b981' }}>
              {tournament.entry_fee_paise === 0 ? 'FREE' : `₹${tournament.entry_fee_paise / 100}`}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Prize Pool</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#0abfbc' }}>
              ₹{tournament.prize_pool_inr || 0}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Format</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff', textTransform: 'capitalize' }}>
              {tournament.format || 'knockout'}
            </p>
          </div>
          <div>
            <p style={{ margin: '0 0 4px 0', fontSize: 12, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Starts At</p>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
              {new Date(tournament.starts_at).toLocaleDateString()}
            </p>
          </div>
        </div>

        <div className="staff-trn-actions" style={{ marginTop: 16 }}>
          {/* Show these buttons when registration is open or closed but not yet live */}
          {tournament.status === 'registration' && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void toggleRegistration()}
              >
                {tournament.registration_open ? '🚫 Close registration' : '✅ Open registration'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={onOpenBracketGenerator}
              >
                {matches.length > 0 ? '🔄 Regenerate bracket' : '⚔ Generate bracket'}
              </button>
            </>
          )}
          {/* Show regenerate for live tournaments too */}
          {tournament.status === 'live' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={onOpenBracketGenerator}
            >
              🔄 Regenerate bracket
            </button>
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
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void toggleAdminsList()}
          >
            {showAdmins ? 'Hide admins' : '👥 View match admins'}
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
            <h4 className="staff-h3" style={{ marginBottom: 16 }}>
              Edit Tournament Settings
              {!isDraft && <span className="muted small" style={{ marginLeft: 8 }}>(Limited - Tournament is live)</span>}
            </h4>
            
            {isDraft ? (
              <>
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
                    <label className="auth-label">Game</label>
                    <input
                      type="text"
                      className="auth-input"
                      value={editForm.game}
                      onChange={(e) => setEditForm({ ...editForm, game: e.target.value })}
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Mode</label>
                    <select
                      className="auth-input"
                      value={editForm.mode}
                      onChange={(e) => setEditForm({ ...editForm, mode: e.target.value })}
                    >
                      <option value="solo">Solo</option>
                      <option value="duo">Duo</option>
                      <option value="squad">Squad</option>
                      <option value="team">Team</option>
                    </select>
                  </div>
                </div>

                <div className="auth-field" style={{ marginBottom: 16 }}>
                  <label className="auth-label">Banner Image</label>
                  {editForm.banner_url && (
                    <div style={{ marginBottom: 8 }}>
                      <img src={editForm.banner_url} alt="Banner" style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8 }} />
                    </div>
                  )}
                  <input
                    ref={bannerInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => e.target.files?.[0] && handleBannerUpload(e.target.files[0])}
                    style={{ display: 'block', marginBottom: 4 }}
                  />
                  {uploadingBanner && <p className="muted small">Uploading...</p>}
                  <p className="muted small">Recommended: 1200x400px, JPG/PNG/WebP, max 3MB</p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="auth-field">
                    <label className="auth-label">Starts At</label>
                    <input
                      type="datetime-local"
                      className="auth-input"
                      value={editForm.starts_at ? new Date(editForm.starts_at).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setEditForm({ ...editForm, starts_at: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                    />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Ends At</label>
                    <input
                      type="datetime-local"
                      className="auth-input"
                      value={editForm.ends_at ? new Date(editForm.ends_at).toISOString().slice(0, 16) : ''}
                      onChange={(e) => setEditForm({ ...editForm, ends_at: e.target.value ? new Date(e.target.value).toISOString() : '' })}
                    />
                  </div>
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

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                  <div className="auth-field">
                    <label className="auth-label">Entry Fee (₹)</label>
                    <input
                      type="number"
                      className="auth-input"
                      value={0}
                      disabled
                      min={0}
                      step={1}
                    />
                    <p className="muted small" style={{ marginTop: 4, color: '#f59e0b' }}>
                      ⚠️ Paid entry not supported yet - all tournaments must be FREE
                    </p>
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
              </>
            ) : (
              <>
                <p className="muted small" style={{ marginBottom: 16 }}>
                  ⚠️ Live tournaments have limited edit options to prevent disrupting participants.
                  Only participant capacity can be adjusted.
                </p>
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
              </>
            )}

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

        {showAdmins && (
          <div className="staff-card" style={{ marginTop: 16, background: '#0a0f1a' }}>
            <h4 className="staff-h3" style={{ marginBottom: 16 }}>Match Admins</h4>
            {loadingAdmins ? (
              <p className="muted">Loading...</p>
            ) : admins.length === 0 ? (
              <p className="muted">No match admins assigned yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {admins.map((admin) => (
                  <div
                    key={admin.user_id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 12,
                      background: '#121824',
                      borderRadius: 8,
                    }}
                  >
                    <div>
                      <p style={{ fontWeight: 500 }}>{admin.name}</p>
                      <p className="muted small">@{admin.username}</p>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: '#ef4444' }}
                      onClick={() => void removeAdmin(admin.user_id, admin.username)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
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
