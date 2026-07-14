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

  function setRosterField(idx: number, field: 'name' | 'phone', value: string) {
    setRoster((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  const canSubmit = useMemo(() => {
    if (!contactPhone.trim()) return false;
    if (isTeamMode) {
      if (!teamId || roster.length === 0) return false;
      if (roster.some((r) => !r.name.trim() || !r.phone.trim())) return false;
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
          <label className="auth-label" htmlFor="trn-reg-name">Your name</label>
          <input
            id="trn-reg-name"
            className="auth-input"
            value={contactName}
            maxLength={120}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="Full name"
          />

          <label className="auth-label" htmlFor="trn-reg-phone">Phone number *</label>
          <input
            id="trn-reg-phone"
            className="auth-input"
            value={contactPhone}
            maxLength={20}
            onChange={(e) => setContactPhone(e.target.value)}
            placeholder="Organisers will reach you here on match day"
            inputMode="tel"
          />

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
                    <p className="auth-label">Squad roster — name &amp; phone for every player *</p>
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
                          className="auth-input"
                          value={r.phone}
                          maxLength={20}
                          placeholder="Phone"
                          inputMode="tel"
                          onChange={(e) => setRosterField(i, 'phone', e.target.value)}
                        />
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
          >
            {submitting ? 'Submitting…' : waitlist ? 'Join waitlist' : tournament.entry_fee_paise === 0 ? 'Register — FREE' : `Register ₹${tournament.entry_fee_paise / 100}`}
          </button>
        </div>
      </div>
    </div>
  );
}
