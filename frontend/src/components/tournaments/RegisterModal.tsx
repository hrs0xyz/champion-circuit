import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../lib/api';
import {
  ccApi, type RegisterPayload, type RosterEntry, type Team, type Tournament,
} from '../../lib/ccApi';

const TEAM_MODES = new Set(['duo', 'squad', 'team']);

type RegisterModalProps = {
  tournament: Tournament;
  /** true → the tournament is full, submit joins the waitlist instead */
  waitlist: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
};

export function RegisterModal({ tournament, waitlist, onClose, onDone }: RegisterModalProps) {
  const { user } = useAuth();
  const isTeamMode = TEAM_MODES.has(tournament.mode);

  const [contactName, setContactName] = useState(user?.display_name || user?.name || '');
  const [contactPhone, setContactPhone] = useState(user?.phone || '');
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamId, setTeamId] = useState(0);
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [teamsLoading, setTeamsLoading] = useState(isTeamMode);

  useEffect(() => {
    if (!isTeamMode) return;
    ccApi.myTeams()
      .then((all) => {
        // Only the captain can register the squad
        const mine = all.filter((t) => t.leader_user_id === user?.id);
        setTeams(mine);
        if (mine.length === 1) selectTeam(mine[0]);
      })
      .catch(() => setTeams([]))
      .finally(() => setTeamsLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeamMode]);

  function selectTeam(team: Team) {
    setTeamId(team.id);
    setRoster((team.members ?? []).map((m) => ({
      user_id: m.user_id,
      name: m.name,
      phone: m.user_id === user?.id ? (user?.phone || m.phone || '') : (m.phone || ''),
    })));
  }

  function validatePhone(phone: string): boolean {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10;
  }

  function handleContactPhoneChange(value: string) {
    // Only allow digits
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 10) {
      setContactPhone(cleaned);
      setPhoneError(null);
      if (cleaned.length > 0 && cleaned.length < 10) {
        setPhoneError('Phone number must be exactly 10 digits');
      }
    }
  }

  function setRosterField(idx: number, field: 'name' | 'phone', value: string) {
    if (field === 'phone') {
      // Only allow digits and max 10 digits for roster phones
      const cleaned = value.replace(/\D/g, '');
      if (cleaned.length <= 10) {
        setRoster((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: cleaned } : r)));
      }
    } else {
      setRoster((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
    }
  }

  const canSubmit = useMemo(() => {
    if (!contactPhone.trim() || !validatePhone(contactPhone)) return false;
    if (isTeamMode) {
      if (!teamId || roster.length === 0) return false;
      if (roster.some((r) => !r.name.trim() || !r.phone.trim() || !validatePhone(r.phone))) return false;
    }
    return true;
  }, [contactPhone, isTeamMode, teamId, roster]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    const payload: RegisterPayload = {
      contact_name: contactName.trim(),
      contact_phone: contactPhone.trim(),
      ...(isTeamMode ? { team_id: teamId, roster } : {}),
    };
    try {
      if (waitlist) {
        await ccApi.joinTournamentWaitlist(tournament.id, payload);
        onDone('You’re on the waitlist — we’ll promote you automatically if a spot opens.');
      } else {
        await ccApi.registerTournament(tournament.id, payload);
        onDone('Registration confirmed. Good luck!');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong — try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="modal-header">
          <p className="modal-eyebrow">
            {waitlist ? 'Join the waitlist' : 'Register'} · {tournament.entry_fee_paise === 0 ? 'FREE' : `₹${tournament.entry_fee_paise / 100}`}
          </p>
          <h2 className="modal-title">{tournament.name}</h2>
        </div>

        <div className="trn-register-form">
          <label className="auth-label" htmlFor="trn-reg-name">
            Your name
            {!waitlist && <span className="help-text" style={{ marginLeft: 8, fontWeight: 400, color: '#888' }}>(optional)</span>}
          </label>
          <input
            id="trn-reg-name"
            className="auth-input"
            value={contactName}
            maxLength={120}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Full name for tournament records"
          />

          <label className="auth-label" htmlFor="trn-reg-phone">
            Phone number *
            {contactPhone && validatePhone(contactPhone) && (
              <span style={{ marginLeft: 8, color: '#10b981', fontSize: '0.875rem' }}>✓ Valid</span>
            )}
          </label>
          <input
            id="trn-reg-phone"
            className={`auth-input${phoneError ? ' error' : ''}`}
            value={contactPhone}
            onChange={(e) => handleContactPhoneChange(e.target.value)}
            placeholder="10-digit mobile number (e.g., 9876543210)"
            inputMode="numeric"
            pattern="[0-9]*"
          />
          {phoneError && <p className="auth-error" style={{ marginTop: 4, fontSize: '0.875rem' }}>{phoneError}</p>}
          {!phoneError && contactPhone.length === 0 && (
            <p className="help-text" style={{ marginTop: 4, fontSize: '0.875rem', color: '#888' }}>
              Organizers will contact you on match day. Your phone number will be saved to your profile.
            </p>
          )}
          {!phoneError && contactPhone.length === 10 && user?.phone !== contactPhone && (
            <p className="help-text" style={{ marginTop: 4, fontSize: '0.875rem', color: '#10b981' }}>
              ✓ This will update your profile phone number
            </p>
          )}

          {isTeamMode ? (
            teamsLoading ? (
              <p className="muted small">Loading your teams…</p>
            ) : teams.length === 0 ? (
              <p className="auth-error" style={{ marginTop: 12 }}>
                This is a {tournament.mode} tournament — you need to be the captain of a team to
                register. Create a team from your profile first.
              </p>
            ) : (
              <>
                <label className="auth-label" htmlFor="trn-reg-team">Your team *</label>
                <select
                  id="trn-reg-team"
                  className="auth-input"
                  value={teamId}
                  onChange={(e) => {
                    const team = teams.find((t) => t.id === Number(e.target.value));
                    if (team) selectTeam(team);
                  }}
                >
                  <option value={0} disabled>Select a team…</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.member_count} members)</option>
                  ))}
                </select>

                {roster.length > 0 ? (
                  <div className="trn-roster">
                    <p className="auth-label">Squad roster — name &amp; 10-digit phone for every player *</p>
                    <p className="help-text" style={{ marginTop: 4, marginBottom: 12, fontSize: '0.875rem', color: '#888' }}>
                      Fill in contact details for all squad members
                    </p>
                    {roster.map((r, i) => (
                      <div key={r.user_id} className="trn-roster__row">
                        <input
                          className="auth-input"
                          value={r.name}
                          maxLength={120}
                          placeholder={`Player ${i + 1} name`}
                          onChange={(e) => setRosterField(i, 'name', e.target.value)}
                        />
                        <input
                          className={`auth-input${r.phone && !validatePhone(r.phone) ? ' error' : ''}`}
                          value={r.phone}
                          placeholder="10-digit phone"
                          inputMode="numeric"
                          pattern="[0-9]*"
                          onChange={(e) => setRosterField(i, 'phone', e.target.value)}
                        />
                        {r.phone && validatePhone(r.phone) && (
                          <span style={{ marginLeft: 8, color: '#10b981', fontSize: '0.875rem' }}>✓</span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </>
            )
          ) : null}

          {error ? <p className="auth-error" style={{ marginTop: 12 }}>{error}</p> : null}
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!canSubmit || submitting}
            onClick={() => void submit()}
            title={!canSubmit ? 'Please fill in all required fields with valid information' : ''}
          >
            {submitting ? 'Submitting…' : waitlist ? 'Join waitlist' : tournament.entry_fee_paise === 0 ? 'Register — FREE' : `Pay ₹${tournament.entry_fee_paise / 100} & Register`}
          </button>
        </div>
      </div>
    </div>
  );
}
