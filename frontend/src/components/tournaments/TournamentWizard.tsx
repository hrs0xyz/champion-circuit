import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../../lib/api';
import { ccApi, type Category, type Tournament } from '../../lib/ccApi';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

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
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    name: '',
    game: '',
    mode: 'solo',
    format_type: 'knockout',
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

  const set = (patch: Partial<typeof form>) => {
    setForm((f) => ({ ...f, ...patch }));
    // Clear field errors when user edits
    Object.keys(patch).forEach((key) => {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    });
  };

  async function handleBannerUpload(file: File) {
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setFieldErrors((prev) => ({ ...prev, banner_url: 'Please upload a JPG, PNG, or WebP image' }));
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setFieldErrors((prev) => ({ ...prev, banner_url: 'Image must be 3MB or smaller' }));
      return;
    }

    setUploadingBanner(true);
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.banner_url;
      return next;
    });

    try {
      const token = localStorage.getItem('cc_token');
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await fetch(`${BASE_URL}/api/uploads/tournament-banner`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? 'Upload failed');
      }

      const result = await response.json() as { url: string };
      set({ banner_url: result.url });
    } catch (err) {
      setFieldErrors((prev) => ({ 
        ...prev, 
        banner_url: err instanceof Error ? err.message : 'Upload failed — try again' 
      }));
    } finally {
      setUploadingBanner(false);
      if (bannerInputRef.current) bannerInputRef.current.value = '';
    }
  }

  function validateStep1(): boolean {
    const errors: Record<string, string> = {};
    
    if (form.name.trim().length < 2) {
      errors.name = 'Tournament name must be at least 2 characters';
    }
    if (form.max_participants < 2) {
      errors.max_participants = 'Must have at least 2 participants';
    }
    if (form.min_participants > form.max_participants) {
      errors.min_participants = 'Cannot be greater than max participants';
    }
    if (form.registration_deadline && form.starts_at) {
      const deadline = new Date(form.registration_deadline);
      const start = new Date(form.starts_at);
      if (deadline > start) {
        errors.registration_deadline = 'Registration must close before tournament starts';
      }
    }
    if (form.starts_at && form.ends_at) {
      const start = new Date(form.starts_at);
      const end = new Date(form.ends_at);
      if (end <= start) {
        errors.ends_at = 'End time must be after start time';
      }
    }
    if (form.starts_at) {
      const start = new Date(form.starts_at);
      const now = new Date();
      if (start < now) {
        errors.starts_at = 'Tournament must start in the future';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function addStage() {
    const newStage: StageDraft = {
      name: stages.length === 0 ? 'Main event' : `Stage ${stages.length + 1}`,
      venue_id: venues ? form.venue_id : 0,
      location_name: '',
      starts_at: form.starts_at, // Pre-fill from tournament start time
      ends_at: form.ends_at,     // Pre-fill from tournament end time
      notes: '',
    };
    setStages((s) => [...s, newStage]);
  }

  function duplicateStage(index: number) {
    const original = stages[index];
    const duplicate: StageDraft = {
      ...original,
      name: `${original.name} (copy)`,
    };
    setStages((s) => [...s.slice(0, index + 1), duplicate, ...s.slice(index + 1)]);
  }

  function removeStage(index: number) {
    if (stages.length === 1 || window.confirm(`Remove "${stages[index].name}"?`)) {
      setStages((s) => s.filter((_, idx) => idx !== index));
    }
  }

  function setStage(i: number, patch: Partial<StageDraft>) {
    setStages((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  }

  const step1Valid = form.name.trim().length >= 2 && form.max_participants >= 2;

  function goToStep2() {
    if (validateStep1()) {
      setStep(2);
    }
  }

  async function save(publish: boolean) {
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      game: form.game,
      mode: form.mode,
      format: form.format_type,
      format_type: form.format_type,
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
      // Owner flow has no venue select — stages without a custom location
      // default to the tournament's own venue (slot blocking + map need it)
      const stageVenueId = s.venue_id
        || (!venues && !s.location_name.trim() ? (t.venue_id ?? 0) : 0);
      try {
        await ccApi.createStage(t.id, {
          name: s.name.trim(),
          stage_order: i + 1,
          venue_id: stageVenueId,
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
        <button type="button" className="staff-action-btn" onClick={onClose}>Close wizard</button>
      </div>

      {/* Progress Steps */}
      <div className="staff-wizard-steps">
        {([
          ['1', 'Details', step1Valid], 
          ['2', 'Stages', true], 
          ['3', 'Review', true]
        ] as const).map(([n, label, isValid]) => (
          <button
            key={n}
            type="button"
            className={`staff-wizard-step${step === Number(n) ? ' staff-wizard-step--active' : ''}${step > Number(n) ? ' staff-wizard-step--done' : ''}`}
            onClick={() => {
              const targetStep = Number(n) as 1 | 2 | 3;
              if (targetStep < step) {
                setStep(targetStep);
              } else if (targetStep === 2 && step === 1 && validateStep1()) {
                setStep(2);
              } else if (targetStep === step) {
                // Already on this step, do nothing
              }
            }}
            disabled={step === 1 && Number(n) > 1}
            style={{ cursor: step > Number(n) || (Number(n) === 2 && step === 1 && step1Valid) ? 'pointer' : 'default' }}
          >
            <span className="step-number">{step > Number(n) ? '✓' : n}</span>
            <span className="step-label">{label}</span>
            {Number(n) === 1 && !isValid && step !== 1 && <span style={{ color: '#ef4444', marginLeft: 8 }}>⚠</span>}
          </button>
        ))}
      </div>

      {error ? <p className="staff-msg staff-msg--err">{error}</p> : null}

      {step === 1 ? (
        <div className="staff-form-grid">
          <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
            <label className="auth-label">Tournament name *</label>
            <input className={`auth-input${fieldErrors.name ? ' error' : ''}`} value={form.name} maxLength={200}
              onChange={(e) => set({ name: e.target.value })} placeholder="EA FC Winter Cup 2026" />
            {fieldErrors.name && <p className="auth-error" style={{ marginTop: 4, fontSize: '0.875rem' }}>{fieldErrors.name}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label">Game / Sport</label>
            <select className="auth-input" value={form.game} onChange={(e) => set({ game: e.target.value })}>
              <option value="">Select game or sport…</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <p className="help-text" style={{ marginTop: 4, fontSize: '0.875rem', color: '#888' }}>
              Optional — helps players find your tournament
            </p>
          </div>

          <div className="auth-field">
            <label className="auth-label">Mode</label>
            <select className="auth-input" value={form.mode} onChange={(e) => set({ mode: e.target.value })}>
              {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div className="auth-field">
            <label className="auth-label">Format</label>
            <select className="auth-input" value={form.format_type} onChange={(e) => set({ format_type: e.target.value })}>
              <option value="knockout">Knockout (Single Elimination)</option>
              <option value="groups_knockout">Groups + Knockout</option>
              <option value="round_robin">Round Robin (Everyone plays everyone)</option>
            </select>
            <p className="help-text" style={{ marginTop: 4, fontSize: '0.875rem', color: '#888' }}>
              {form.format_type === 'knockout' && 'Classic bracket - players eliminated after one loss'}
              {form.format_type === 'groups_knockout' && 'Group stage with top N advancing to knockout bracket'}
              {form.format_type === 'round_robin' && 'Everyone plays everyone once - best record wins'}
            </p>
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
            <label className="auth-label">Max participants *</label>
            <input className={`auth-input${fieldErrors.max_participants ? ' error' : ''}`} type="number" min={2} value={form.max_participants}
              onChange={(e) => set({ max_participants: Math.max(2, Number(e.target.value)) })} />
            {fieldErrors.max_participants && <p className="auth-error" style={{ marginTop: 4, fontSize: '0.875rem' }}>{fieldErrors.max_participants}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label">Min participants (auto-cancels if below this)</label>
            <input className={`auth-input${fieldErrors.min_participants ? ' error' : ''}`} type="number" min={0} value={form.min_participants}
              onChange={(e) => set({ min_participants: Math.max(0, Number(e.target.value)) })} placeholder="0 = no minimum" />
            {fieldErrors.min_participants && <p className="auth-error" style={{ marginTop: 4, fontSize: '0.875rem' }}>{fieldErrors.min_participants}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label">Registration deadline</label>
            <input className={`auth-input${fieldErrors.registration_deadline ? ' error' : ''}`} type="datetime-local" value={form.registration_deadline}
              onChange={(e) => set({ registration_deadline: e.target.value })} />
            {fieldErrors.registration_deadline && <p className="auth-error" style={{ marginTop: 4, fontSize: '0.875rem' }}>{fieldErrors.registration_deadline}</p>}
            {!fieldErrors.registration_deadline && <p className="help-text" style={{ marginTop: 4, fontSize: '0.875rem', color: '#888' }}>When registration closes</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label">Tournament starts at *</label>
            <input className={`auth-input${fieldErrors.starts_at ? ' error' : ''}`} type="datetime-local" value={form.starts_at}
              onChange={(e) => set({ starts_at: e.target.value })} />
            {fieldErrors.starts_at && <p className="auth-error" style={{ marginTop: 4, fontSize: '0.875rem' }}>{fieldErrors.starts_at}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label">Tournament ends at</label>
            <input className={`auth-input${fieldErrors.ends_at ? ' error' : ''}`} type="datetime-local" value={form.ends_at}
              onChange={(e) => set({ ends_at: e.target.value })} />
            {fieldErrors.ends_at && <p className="auth-error" style={{ marginTop: 4, fontSize: '0.875rem' }}>{fieldErrors.ends_at}</p>}
          </div>

          <div className="auth-field">
            <label className="auth-label">Prize pool (₹)</label>
            <input className="auth-input" type="number" min={0} step={100} value={form.prize_pool_inr}
              onChange={(e) => set({ prize_pool_inr: Math.max(0, Number(e.target.value)) })} placeholder="0" />
          </div>

          <div className="auth-field">
            <label className="auth-label">Prize description</label>
            <input className="auth-input" value={form.prize_description} maxLength={1000}
              onChange={(e) => set({ prize_description: e.target.value })}
              placeholder="₹5,000 + trophies for top 3" />
          </div>

          <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
            <label className="auth-label">Banner image</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleBannerUpload(file);
                  }}
                  style={{ display: 'block', marginBottom: 8 }}
                />
                <p className="help-text" style={{ fontSize: '0.875rem', color: '#888' }}>
                  Recommended: 1200x400px, JPG/PNG/WebP, max 3MB
                </p>
                {fieldErrors.banner_url && <p className="auth-error" style={{ marginTop: 4, fontSize: '0.875rem' }}>{fieldErrors.banner_url}</p>}
                <div style={{ marginTop: 12 }}>
                  <input className="auth-input" value={form.banner_url} maxLength={500}
                    onChange={(e) => set({ banner_url: e.target.value })} placeholder="Or paste image URL: https://…" />
                </div>
              </div>
              {form.banner_url && (
                <div style={{ width: 200, flexShrink: 0 }}>
                  <img 
                    src={form.banner_url} 
                    alt="Banner preview" 
                    style={{ width: '100%', height: 'auto', borderRadius: 8, border: '1px solid #333' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      setFieldErrors((prev) => ({ ...prev, banner_url: 'Invalid image URL' }));
                    }}
                  />
                  <button 
                    type="button" 
                    className="btn btn-ghost btn-sm" 
                    style={{ marginTop: 8, width: '100%' }}
                    onClick={() => set({ banner_url: '' })}
                  >
                    Remove
                  </button>
                </div>
              )}
              {uploadingBanner && <p className="muted small">Uploading…</p>}
            </div>
          </div>

          <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
            <label className="auth-label">Description</label>
            <textarea className="auth-input" rows={3} value={form.description} maxLength={3000}
              onChange={(e) => set({ description: e.target.value })} placeholder="Tell players what to expect from this tournament…" />
            <p className="help-text" style={{ marginTop: 4, fontSize: '0.875rem', color: '#888' }}>
              {form.description.length} / 3000 characters
            </p>
          </div>

          <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
            <label className="auth-label">Rules</label>
            <textarea className="auth-input" rows={4} value={form.rules} maxLength={3000}
              onChange={(e) => set({ rules: e.target.value })} placeholder="Tournament rules, format, scoring system…" />
            <p className="help-text" style={{ marginTop: 4, fontSize: '0.875rem', color: '#888' }}>
              {form.rules.length} / 3000 characters
            </p>
          </div>

          <label className="staff-checkbox">
            <input type="checkbox" checked={form.awards_leaderboard_points}
              onChange={(e) => set({ awards_leaderboard_points: e.target.checked })} />
            <span>Awards leaderboard points (Winner 100 · Runner-up 60 · SF 35 · QF 20)</span>
          </label>

          {isAdmin ? (
            <label className="staff-checkbox">
              <input type="checkbox" checked={form.is_featured}
                onChange={(e) => set({ is_featured: e.target.checked })} />
              <span>Featured (pinned on the tournaments browse page)</span>
            </label>
          ) : null}

          <div style={{ gridColumn: '1 / -1', marginTop: 16 }}>
            <button type="button" className="btn btn-primary" disabled={!step1Valid} onClick={goToStep2}>
              Next: Configure stages →
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <p className="muted small" style={{ marginBottom: 16 }}>
            <strong>Stages organize your tournament by time and location.</strong> For example: "Qualifiers" at Game Zone A, then "Finals" at Game Zone B. 
            <br />Skip this section if your entire tournament happens at one location.
          </p>
          
          {stages.length === 0 ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', background: '#1a1a1a', borderRadius: 8, marginBottom: 16 }}>
              <p className="muted" style={{ marginBottom: 12 }}>No stages yet — your tournament will use the primary venue for all matches.</p>
              <button type="button" className="btn btn-primary btn-sm" onClick={addStage}>
                + Add first stage
              </button>
            </div>
          ) : (
            stages.map((s, i) => (
              <div key={i} className="staff-stage-row" style={{ marginBottom: 16, padding: 16, background: '#1a1a1a', borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ margin: 0, fontSize: '1.1rem' }}>Stage {i + 1}</h4>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-sm"
                      onClick={() => duplicateStage(i)}
                      title="Duplicate this stage"
                    >
                      Copy
                    </button>
                    <button 
                      type="button" 
                      className="staff-action-btn staff-action-btn--danger"
                      onClick={() => removeStage(i)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                
                <div className="staff-form-grid">
                  <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="auth-label">Stage name *</label>
                    <input className="auth-input" value={s.name} maxLength={120}
                      onChange={(e) => setStage(i, { name: e.target.value })} 
                      placeholder="e.g., Qualifiers, Semi-Finals, Grand Finals" />
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
                        placeholder="School ground, community hall…"
                        onChange={(e) => setStage(i, { location_name: e.target.value })} />
                    </div>
                  ) : null}

                  <div className="auth-field">
                    <label className="auth-label">Starts at</label>
                    <input className="auth-input" type="datetime-local" value={s.starts_at}
                      onChange={(e) => setStage(i, { starts_at: e.target.value })} />
                  </div>

                  <div className="auth-field">
                    <label className="auth-label">Ends at</label>
                    <input className="auth-input" type="datetime-local" value={s.ends_at}
                      onChange={(e) => setStage(i, { ends_at: e.target.value })} />
                  </div>

                  <div className="auth-field" style={{ gridColumn: '1 / -1' }}>
                    <label className="auth-label">Notes (optional)</label>
                    <input className="auth-input" value={s.notes} maxLength={2000}
                      onChange={(e) => setStage(i, { notes: e.target.value })}
                      placeholder="Station count, wave details, special instructions…" />
                  </div>
                </div>
              </div>
            ))
          )}

          {stages.length > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={addStage} style={{ marginBottom: 16 }}>
              + Add another stage
            </button>
          )}

          <div className="staff-trn-actions" style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
              ← Back to details
            </button>
            <button 
              type="button" 
              className="btn btn-secondary" 
              disabled={saving} 
              onClick={() => void save(false)}
            >
              {saving ? 'Saving…' : 'Save draft & exit'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setStep(3)}>
              Next: Review & publish →
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <div className="staff-card" style={{ padding: 24, background: '#1a1a1a', borderRadius: 8, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <h3 className="staff-card__title" style={{ fontSize: '1.5rem', marginBottom: 8 }}>
                  {form.name || 'Untitled tournament'}
                </h3>
                <p className="staff-card__meta" style={{ fontSize: '0.95rem', color: '#aaa' }}>
                  {form.game ? `${form.game} · ` : ''}{form.mode} · knockout · max {form.max_participants} players
                  {form.min_participants > 0 ? ` · min ${form.min_participants}` : ''}
                </p>
              </div>
              {form.banner_url && (
                <img 
                  src={form.banner_url} 
                  alt="Tournament banner" 
                  style={{ width: 200, height: 'auto', borderRadius: 8, marginLeft: 16 }}
                />
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16, marginTop: 16 }}>
              <div>
                <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: 4 }}>Entry Fee</p>
                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#10b981' }}>FREE</p>
              </div>
              
              {form.prize_pool_inr > 0 && (
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: 4 }}>Prize Pool</p>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>₹{form.prize_pool_inr.toLocaleString()}</p>
                  {form.prize_description && <p style={{ fontSize: '0.875rem', color: '#aaa', marginTop: 4 }}>{form.prize_description}</p>}
                </div>
              )}

              {form.registration_deadline && (
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: 4 }}>Registration Closes</p>
                  <p style={{ fontSize: '0.95rem' }}>{new Date(form.registration_deadline).toLocaleString()}</p>
                </div>
              )}

              {form.starts_at && (
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: 4 }}>Tournament Starts</p>
                  <p style={{ fontSize: '0.95rem' }}>{new Date(form.starts_at).toLocaleString()}</p>
                </div>
              )}

              {form.ends_at && (
                <div>
                  <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: 4 }}>Tournament Ends</p>
                  <p style={{ fontSize: '0.95rem' }}>{new Date(form.ends_at).toLocaleString()}</p>
                </div>
              )}
            </div>

            {form.description && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #333' }}>
                <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: 8 }}>Description</p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{form.description}</p>
              </div>
            )}

            {form.rules && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #333' }}>
                <p style={{ fontSize: '0.875rem', color: '#888', marginBottom: 8 }}>Rules</p>
                <p style={{ whiteSpace: 'pre-wrap' }}>{form.rules}</p>
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #333', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {form.awards_leaderboard_points && (
                <div style={{ padding: '8px 12px', background: '#10b98120', borderRadius: 6, fontSize: '0.875rem' }}>
                  ✓ Awards leaderboard points
                </div>
              )}
              {form.is_featured && (
                <div style={{ padding: '8px 12px', background: '#f59e0b20', borderRadius: 6, fontSize: '0.875rem' }}>
                  ⭐ Featured tournament
                </div>
              )}
            </div>
          </div>

          {stages.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ fontSize: '1.1rem', marginBottom: 12 }}>Stages ({stages.length})</h4>
              <div style={{ display: 'flex', gap: 12, flexDirection: 'column' }}>
                {stages.map((s, i) => (
                  <div key={i} style={{ padding: 16, background: '#1a1a1a', borderRadius: 8 }}>
                    <p style={{ fontWeight: 600, marginBottom: 4 }}>
                      {i + 1}. {s.name || `Stage ${i + 1}`}
                    </p>
                    {(s.venue_id > 0 || s.location_name) && (
                      <p style={{ fontSize: '0.875rem', color: '#aaa' }}>
                        📍 {s.venue_id > 0 ? venues?.find(v => v.id === s.venue_id)?.name : s.location_name}
                      </p>
                    )}
                    {s.starts_at && (
                      <p style={{ fontSize: '0.875rem', color: '#aaa' }}>
                        🕐 {new Date(s.starts_at).toLocaleString()} - {s.ends_at ? new Date(s.ends_at).toLocaleString() : 'TBD'}
                      </p>
                    )}
                    {s.notes && (
                      <p style={{ fontSize: '0.875rem', color: '#aaa', marginTop: 4 }}>
                        {s.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="staff-trn-actions" style={{ display: 'flex', gap: 12, marginTop: 24 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setStep(2)}>
              ← Back to stages
            </button>
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => void save(false)}>
              {saving ? 'Saving…' : 'Save as draft'}
            </button>
            {isAdmin ? (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save(true)}>
                {saving ? 'Publishing…' : 'Publish & open registration'}
              </button>
            ) : (
              <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void save(false)}>
                {saving ? 'Saving…' : 'Submit for approval'}
              </button>
            )}
          </div>

          {!isAdmin && (
            <p className="muted small" style={{ marginTop: 16, padding: 12, background: '#1a1a1a', borderRadius: 8 }}>
              ℹ️ Your tournament will be saved as a draft and sent to the platform admin for review and approval before going live.
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
