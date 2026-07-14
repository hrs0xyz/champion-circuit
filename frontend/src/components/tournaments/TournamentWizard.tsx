import { useEffect, useState } from 'react';
import { ApiError } from '../../lib/api';
import { ccApi, type Category, type Tournament } from '../../lib/ccApi';

/** "2026-07-20T18:00" (datetime-local) → ISO-8601 with the local offset. */
export function toIsoWithOffset(local: string): string {
  if (!local) return '';
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return '';
  const off = -d.getTimezoneOffset();
  const sign = off >= 0 ? '+' : '-';
  const pad = (n: number) => String(Math.abs(n)).padStart(2, '0');
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:00` +
    `${sign}${pad(Math.trunc(Math.abs(off) / 60))}:${pad(Math.abs(off) % 60)}`;
}

type VenueOption = { id: number; name: string };

type StageDraft = {
  name: string;
  venue_id: number;
  location_name: string;
  starts_at: string;   // datetime-local
  ends_at: string;
  notes: string;
};

const MODES = ['solo', 'duo', 'squad', 'team'] as const;

type TournamentWizardProps = {
  /** Selectable venues; null → venue is locked to the caller's own venue. */
  venues: VenueOption[] | null;
  /** Super admins can feature + publish immediately; owners save drafts. */
  isAdmin: boolean;
  /** POST that creates the tournament (admin vs venue-owner endpoint). */
  create: (payload: object) => Promise<Tournament>;
  onDone: (t: Tournament, message: string) => void;
  onClose: () => void;
};

export function TournamentWizard({ venues, isAdmin, create, onDone, onClose }: TournamentWizardProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    game: '',
    mode: 'solo',
    venue_id: 0,
    max_participants: 16,
    min_participants: 0,
    prize_pool_inr: 0,
    prize_description: '',
    registration_deadline: '',
    starts_at: '',
    ends_at: '',
    description: '',
    rules: '',
    banner_url: '',
    awards_leaderboard_points: true,
    is_featured: false,
  });
  const [stages, setStages] = useState<StageDraft[]>([]);

  useEffect(() => {
    ccApi.categories().then(setCategories).catch(() => setCategories([]));
  }, []);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  function addStage() {
    setStages((s) => [...s, {
      name: s.length === 0 ? 'Main event' : `Stage ${s.length + 1}`,
      venue_id: venues ? form.venue_id : 0,
      location_name: '',
      starts_at: '',
      ends_at: '',
      notes: '',
    }]);
  }

  function setStage(i: number, patch: Partial<StageDraft>) {
    setStages((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  }

  const step1Valid = form.name.trim().length >= 2 && form.max_participants >= 2;

  async function save(publish: boolean) {
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      game: form.game,
      mode: form.mode,
      format: 'knockout',
      venue_id: form.venue_id,
      max_participants: form.max_participants,
      min_participants: form.min_participants,
      entry_fee_paise: 0,   // free entry at launch
      prize_pool_paise: Math.round(form.prize_pool_inr * 100),
      prize_description: form.prize_description,
      registration_deadline: toIsoWithOffset(form.registration_deadline),
      starts_at: toIsoWithOffset(form.starts_at),
      ends_at: toIsoWithOffset(form.ends_at),
      description: form.description,
      rules: form.rules,
      banner_url: form.banner_url,
      awards_leaderboard_points: form.awards_leaderboard_points,
      is_featured: isAdmin ? form.is_featured : false,
      registration_open: false,
    };
    let t: Tournament;
    try {
      t = await create(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the tournament.');
      setSaving(false);
      return;
    }
    // Stages are created after the tournament exists; report partial failures.
    const stageErrors: string[] = [];
    for (let i = 0; i < stages.length; i += 1) {
      const s = stages[i];
      if (!s.name.trim()) continue;
      try {
        await ccApi.createStage(t.id, {
          name: s.name.trim(),
          stage_order: i + 1,
          venue_id: s.venue_id,
          location_name: s.location_name.trim(),
          starts_at: toIsoWithOffset(s.starts_at),
          ends_at: toIsoWithOffset(s.ends_at),
          notes: s.notes.trim(),
        });
      } catch (err) {
        stageErrors.push(`"${s.name}": ${err instanceof ApiError ? err.message : 'failed'}`);
      }
    }
    let message = `"${t.name}" created as draft.`;
    if (publish && isAdmin) {
      try {
        await ccApi.updateTournament(t.id, { status: 'registration', registration_open: true });
        message = `"${t.name}" is live — registration is open.`;
      } catch (err) {
        stageErrors.push(`publish: ${err instanceof ApiError ? err.message : 'failed'}`);
      }
    }
    if (stageErrors.length > 0) message += ` Issues: ${stageErrors.join('; ')}`;
    onDone(t, message);
  }

  return (
    <div className="staff-section" style={{ marginBottom: 24 }}>
      <div className="staff-section__header">
        <h3 className="staff-h3">Create tournament</h3>
        <button type="button" className="staff-action-btn" onClick={onClose}>Cancel</button>
      </div>

      <div className="staff-wizard-steps">
        {([['1', 'Details'], ['2', 'Stages'], ['3', 'Review']] as const).map(([n, label]) => (
          <span
            key={n}
            className={`staff-wizard-step${step === Number(n) ? ' staff-wizard-step--active' : ''}${step > Number(n) ? ' staff-wizard-step--done' : ''}`}
          >
            {n}. {label}
          </span>
        ))}
      </div>

      {error ? <p className="staff-msg staff-msg--err">{error}</p> : null}

      {step === 1 ? (
        <div className="staff-form-grid">
          <div className="auth-field">
            <label className="auth-label">Name *</label>
            <input className="auth-input" value={form.name} maxLength={200}
              onChange={(e) => set({ name: e.target.value })} placeholder="EA FC Winter Cup" />
          </div>
          <div className="auth-field">
            <label className="auth-label">Game / sport</label>
            <select className="auth-input" value={form.game} onChange={(e) => set({ game: e.target.value })}>
              <option value="">Select…</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
          </div>
          <div className="auth-field">
            <label className="auth-label">Mode</label>
            <select className="auth-input" value={form.mode} onChange={(e) => set({ mode: e.target.value })}>
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="auth-field">
            <label className="auth-label">Format</label>
            <input className="auth-input" value="knockout" disabled title="More formats coming soon" />
          </div>
          {venues ? (
            <div className="auth-field">
              <label className="auth-label">Primary venue</label>
              <select className="auth-input" value={form.venue_id}
                onChange={(e) => set({ venue_id: Number(e.target.value) })}>
                <option value={0}>No venue</option>
                {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
              </select>
            </div>
          ) : null}
          <div className="auth-field">
            <label className="auth-label">Max participants</label>
            <input className="auth-input" type="number" min={2} value={form.max_participants}
              onChange={(e) => set({ max_participants: Math.max(2, Number(e.target.value)) })} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Min participants (0 = no minimum, auto-cancels below this)</label>
            <input className="auth-input" type="number" min={0} value={form.min_participants}
              onChange={(e) => set({ min_participants: Math.max(0, Number(e.target.value)) })} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Registration deadline</label>
            <input className="auth-input" type="datetime-local" value={form.registration_deadline}
              onChange={(e) => set({ registration_deadline: e.target.value })} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Starts at</label>
            <input className="auth-input" type="datetime-local" value={form.starts_at}
              onChange={(e) => set({ starts_at: e.target.value })} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Ends at</label>
            <input className="auth-input" type="datetime-local" value={form.ends_at}
              onChange={(e) => set({ ends_at: e.target.value })} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Prize pool (₹)</label>
            <input className="auth-input" type="number" min={0} value={form.prize_pool_inr}
              onChange={(e) => set({ prize_pool_inr: Math.max(0, Number(e.target.value)) })} />
          </div>
          <div className="auth-field">
            <label className="auth-label">Prize description</label>
            <input className="auth-input" value={form.prize_description} maxLength={1000}
              onChange={(e) => set({ prize_description: e.target.value })}
              placeholder="₹5,000 + trophies for top 3" />
          </div>
          <div className="auth-field">
            <label className="auth-label">Banner URL</label>
            <input className="auth-input" value={form.banner_url} maxLength={500}
              onChange={(e) => set({ banner_url: e.target.value })} placeholder="https://…" />
          </div>
          <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
            <label className="auth-label">Description</label>
            <textarea className="auth-input" rows={3} value={form.description} maxLength={3000}
              onChange={(e) => set({ description: e.target.value })} />
          </div>
          <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
            <label className="auth-label">Rules</label>
            <textarea className="auth-input" rows={4} value={form.rules} maxLength={3000}
              onChange={(e) => set({ rules: e.target.value })} />
          </div>
          <label className="staff-checkbox">
            <input type="checkbox" checked={form.awards_leaderboard_points}
              onChange={(e) => set({ awards_leaderboard_points: e.target.checked })} />
            Awards leaderboard points (Winner 100 · Runner-up 60 · SF 35 · QF 20)
          </label>
          {isAdmin ? (
            <label className="staff-checkbox">
              <input type="checkbox" checked={form.is_featured}
                onChange={(e) => set({ is_featured: e.target.checked })} />
              Featured (pinned on the browse page)
            </label>
          ) : null}
          <div style={{ gridColumn: '1 / -1' }}>
            <button type="button" className="btn btn-primary" disabled={!step1Valid} onClick={() => setStep(2)}>
              Next: stages →
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <p className="muted small" style={{ marginBottom: 12 }}>
            Stages map rounds to locations and time windows (e.g. Qualifiers at Game Zone A,
            Finals at Game Zone B). Skip this for a simple single-venue event — the primary
            venue is used.
          </p>
          {stages.map((s, i) => (
            <div key={i} className="staff-stage-row">
              <div className="auth-field">
                <label className="auth-label">Stage name</label>
                <input className="auth-input" value={s.name} maxLength={120}
                  onChange={(e) => setStage(i, { name: e.target.value })} />
              </div>
              {venues ? (
                <div className="auth-field">
                  <label className="auth-label">Venue</label>
                  <select className="auth-input" value={s.venue_id}
                    onChange={(e) => setStage(i, { venue_id: Number(e.target.value) })}>
                    <option value={0}>Custom location…</option>
                    {venues.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                </div>
              ) : null}
              {s.venue_id === 0 ? (
                <div className="auth-field">
                  <label className="auth-label">Location name</label>
                  <input className="auth-input" value={s.location_name} maxLength={200}
                    placeholder="School ground, hall…"
                    onChange={(e) => setStage(i, { location_name: e.target.value })} />
                </div>
              ) : null}
              <div className="auth-field">
                <label className="auth-label">Starts</label>
                <input className="auth-input" type="datetime-local" value={s.starts_at}
                  onChange={(e) => setStage(i, { starts_at: e.target.value })} />
              </div>
              <div className="auth-field">
                <label className="auth-label">Ends</label>
                <input className="auth-input" type="datetime-local" value={s.ends_at}
                  onChange={(e) => setStage(i, { ends_at: e.target.value })} />
              </div>
              <div className="auth-field">
                <label className="auth-label">Notes (station count, waves…)</label>
                <input className="auth-input" value={s.notes} maxLength={2000}
                  onChange={(e) => setStage(i, { notes: e.target.value })} />
              </div>
              <button type="button" className="staff-action-btn staff-action-btn--danger"
                onClick={() => setStages((prev) => prev.filter((_, idx) => idx !== i))}>
                Remove
              </button>
            </div>
          ))}
          <div className="staff-trn-actions">
            <button type="button" className="btn btn-secondary btn-sm" onClick={addStage}>+ Add stage</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(1)}>← Back</button>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setStep(3)}>Next: review →</button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <div className="staff-card">
            <h3 className="staff-card__title">{form.name || 'Untitled tournament'}</h3>
            <p className="staff-card__meta">
              {form.game || 'no game'} · {form.mode} · knockout · max {form.max_participants}
              {form.min_participants > 0 ? ` · min ${form.min_participants}` : ''}
              {' · '}<strong>FREE entry</strong>
              {form.prize_pool_inr > 0 ? ` · ₹${form.prize_pool_inr} prize pool` : ''}
            </p>
            <p className="staff-card__meta">
              {form.registration_deadline ? `Reg closes ${form.registration_deadline.replace('T', ' ')}` : 'No deadline'}
              {form.starts_at ? ` · starts ${form.starts_at.replace('T', ' ')}` : ''}
              · {form.awards_leaderboard_points ? 'awards leaderboard points' : 'no leaderboard points'}
            </p>
            {stages.length > 0 ? (
              <p className="staff-card__meta">Stages: {stages.map((s) => s.name).join(' → ')}</p>
            ) : null}
          </div>
          <div className="staff-trn-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStep(2)}>← Back</button>
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => void save(false)}>
              {saving ? 'Saving…' : 'Save as draft'}
            </button>
            {isAdmin ? (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save(true)}>
                {saving ? 'Saving…' : 'Publish & open registration'}
              </button>
            ) : null}
          </div>
          {!isAdmin ? (
            <p className="muted small" style={{ marginTop: 10 }}>
              Drafts go to the platform admin for approval — submit from the tournament card once you&apos;re ready.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
