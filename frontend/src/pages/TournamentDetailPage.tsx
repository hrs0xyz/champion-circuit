import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { BracketView } from '../components/tournaments/BracketView';
import { RegisterModal } from '../components/tournaments/RegisterModal';
import { EmptyState } from '../components/ui/EmptyState';
import { PageContainer } from '../components/ui/PageContainer';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../lib/api';
import { ccApi, type TournamentDetail, type TournamentStage } from '../lib/ccApi';

function fmtDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

function mapsUrl(lat: string, lng: string, query: string): string {
  if (lat && lng) return `https://maps.google.com/?q=${lat},${lng}`;
  return `https://maps.google.com/?q=${encodeURIComponent(query)}`;
}

/** "2d 4h 12m" until the ISO timestamp; empty when past/absent. */
function useCountdown(targetIso: string): string {
  const compute = useCallback(() => {
    if (!targetIso) return '';
    const target = new Date(targetIso).getTime();
    if (Number.isNaN(target)) return '';
    const diff = target - Date.now();
    if (diff <= 0) return '';
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const mins = Math.floor((diff % 3_600_000) / 60_000);
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  }, [targetIso]);

  const [label, setLabel] = useState(compute);
  useEffect(() => {
    setLabel(compute());
    const timer = window.setInterval(() => setLabel(compute()), 30_000);
    return () => window.clearInterval(timer);
  }, [compute]);
  return label;
}

function StageCard({ stage, index }: { stage: TournamentStage; index: number }) {
  const locationName = stage.venue?.name || stage.location_name || (stage.is_online ? 'Online' : '');
  const address = stage.venue?.address_line1 || stage.address || '';
  const city = stage.venue?.city || '';
  const lat = stage.venue?.lat || stage.lat || '';
  const lng = stage.venue?.lng || stage.lng || '';
  const hasLocation = Boolean(locationName && locationName !== 'Online');
  return (
    <div className="trn-stage-card">
      <div className="trn-stage-card__order">{index + 1}</div>
      <div className="trn-stage-card__body">
        <h3 className="trn-stage-card__name">{stage.name}</h3>
        {stage.starts_at ? (
          <p className="trn-stage-card__when">
            🗓 {fmtDate(stage.starts_at)}{stage.ends_at ? ` → ${fmtDate(stage.ends_at)}` : ''}
          </p>
        ) : null}
        {locationName ? (
          <p className="trn-stage-card__where">
            📍 {locationName}{city ? `, ${city}` : ''}
            {address ? <span className="muted"> · {address}</span> : null}
          </p>
        ) : null}
        {hasLocation ? (
          <a
            className="trn-stage-card__map"
            href={mapsUrl(lat, lng, `${locationName} ${address} ${city}`.trim())}
            target="_blank"
            rel="noreferrer"
          >
            Open in Google Maps ↗
          </a>
        ) : null}
        {stage.notes ? <p className="muted small trn-stage-card__notes">{stage.notes}</p> : null}
      </div>
    </div>
  );
}

const PODIUM_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export function TournamentDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [t, setT] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [showModal, setShowModal] = useState<null | 'register' | 'waitlist'>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const load = useCallback(() => {
    if (!slug) { setLoading(false); return; }
    ccApi.tournamentBySlug(slug)
      .then(setT)
      .catch(() => setT(null))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const deadlineCountdown = useCountdown(t?.registration_deadline ?? '');
  const startCountdown = useCountdown(t?.starts_at ?? '');

  const isFull = useMemo(
    () => Boolean(t && t.participant_count >= t.max_participants),
    [t],
  );

  if (loading) {
    return (
      <section className="section section-esports">
        <PageContainer narrow>
          <div className="tournament-card-skeleton" />
        </PageContainer>
      </section>
    );
  }

  if (!t) {
    return (
      <section className="section">
        <PageContainer narrow>
          <EmptyState title="Tournament not found" description="It may have been removed, or the link is wrong." />
          <Link className="btn btn-ghost" to="/tournaments">Browse tournaments</Link>
        </PageContainer>
      </section>
    );
  }

  const free = t.entry_fee_paise === 0;
  // Backend additionally enforces the deadline — this only controls visibility
  const canWithdraw = Boolean(t.my_registration) && t.status === 'registration';

  async function withdraw() {
    if (!t || !window.confirm(`Withdraw from ${t.name}? Your spot will be given away.`)) return;
    setBusy(true);
    try {
      await ccApi.withdrawTournament(t.id);
      setNotice('You have withdrawn — your spot has been freed.');
      load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Could not withdraw.');
    } finally {
      setBusy(false);
    }
  }

  async function leaveWaitlist() {
    if (!t) return;
    setBusy(true);
    try {
      await ccApi.leaveTournamentWaitlist(t.id);
      setNotice('Removed from the waitlist.');
      load();
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Could not leave the waitlist.');
    } finally {
      setBusy(false);
    }
  }

  function renderCta() {
    if (t == null) return null;
    if (t.status === 'cancelled') {
      return <span className="trn-cta__closed">This tournament was cancelled</span>;
    }
    if (t.status === 'completed') {
      return <a className="btn btn-secondary" href="#bracket">View results</a>;
    }
    if (t.status === 'live') {
      return <a className="btn btn-primary" href="#bracket">View live bracket</a>;
    }
    // status === 'registration'
    if (t.my_registration) {
      return (
        <div className="trn-cta__registered">
          <span className="trn-cta__badge">Registered ✓</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowQr((v) => !v)}>
            {showQr ? 'Hide check-in QR' : 'Show check-in QR'}
          </button>
          {canWithdraw ? (
            <button type="button" className="btn btn-ghost btn-sm trn-cta__withdraw" disabled={busy} onClick={() => void withdraw()}>
              Withdraw
            </button>
          ) : null}
        </div>
      );
    }
    if (t.on_waitlist) {
      return (
        <div className="trn-cta__registered">
          <span className="trn-cta__badge trn-cta__badge--wait">On the waitlist</span>
          <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void leaveWaitlist()}>
            Leave waitlist
          </button>
        </div>
      );
    }
    if (!user) {
      return (
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate(`/login?next=${encodeURIComponent(`/tournaments/${t.slug}`)}`)}
        >
          Sign in to register{free ? ' — FREE' : ''}
        </button>
      );
    }
    if (t.registration_effectively_open) {
      return (
        <button type="button" className="btn btn-primary trn-cta__register" onClick={() => setShowModal('register')}>
          {free ? 'Register — FREE' : `Register ₹${t.entry_fee_paise / 100}`}
          {deadlineCountdown ? <span className="trn-cta__deadline">closes in {deadlineCountdown}</span> : null}
        </button>
      );
    }
    if (isFull && t.registration_open && deadlineCountdown) {
      return (
        <button type="button" className="btn btn-secondary" onClick={() => setShowModal('waitlist')}>
          Full — join the waitlist
        </button>
      );
    }
    return <span className="trn-cta__closed">Registration closed</span>;
  }

  return (
    <section className={`section section-esports${t.is_exclusive ? ' esports-stage--exclusive' : ''}`}>
      <PageContainer>
        <Link className="muted small back-link" to="/tournaments">← All tournaments</Link>

        {/* ── Hero ── */}
        <div className="trn-hero">
          {t.banner_url ? (
            <div className="trn-hero__banner"><img src={t.banner_url} alt={t.name} /></div>
          ) : null}
          <div className="trn-hero__head">
            <span className={`status-pill status-pill--${t.status}`}>{t.status.replace('_', ' ').toUpperCase()}</span>
            {free ? <span className="free-chip">FREE ENTRY</span> : null}
            {t.is_featured ? <span className="status-pill status-pill--exclusive">Featured</span> : null}
          </div>
          <h1 className="trn-hero__name">{t.name}</h1>
          <p className="muted">
            {t.game}{t.venue?.city ? ` · ${t.venue.city}` : ''}
            {t.status === 'registration' && startCountdown ? ` · starts in ${startCountdown}` : ''}
          </p>
        </div>

        {/* ── Facts row ── */}
        <div className="trn-facts">
          {t.starts_at ? <div className="trn-fact"><span className="trn-fact__icon">📅</span><span>{fmtDate(t.starts_at)}</span></div> : null}
          <div className="trn-fact">
            <span className="trn-fact__icon">💰</span>
            <span>Entry: {free ? <strong className="trn-fact__free">FREE</strong> : `₹${t.entry_fee_paise / 100}`}</span>
          </div>
          {t.prize_pool_paise > 0 || t.prize_description ? (
            <div className="trn-fact">
              <span className="trn-fact__icon">🏆</span>
              <span>{t.prize_description || `Prize pool ₹${t.prize_pool_paise / 100}`}</span>
            </div>
          ) : null}
          <div className="trn-fact"><span className="trn-fact__icon">👥</span><span>{t.participant_count}/{t.max_participants} slots</span></div>
          <div className="trn-fact"><span className="trn-fact__icon">🎮</span><span>{t.mode} · {t.format.replace(/_/g, ' ')}</span></div>
          {t.registration_deadline && t.status === 'registration' ? (
            <div className="trn-fact">
              <span className="trn-fact__icon">⏳</span>
              <span>{deadlineCountdown ? `Registration closes in ${deadlineCountdown}` : 'Registration deadline passed'}</span>
            </div>
          ) : null}
        </div>

        {notice ? <p className="auth-success trn-notice">{notice}</p> : null}

        {/* ── My registration QR ── */}
        {showQr && t.my_registration ? (
          <div className="checkin-qr">
            {t.my_registration.qr_svg ? (
              <div className="checkin-qr__svg" dangerouslySetInnerHTML={{ __html: t.my_registration.qr_svg }} />
            ) : null}
            <p className="checkin-qr__code">Check-in code: <strong>{t.my_registration.checkin_code}</strong></p>
            <p className="muted small">Show this at the venue desk on match day.</p>
          </div>
        ) : null}

        {t.description ? <p className="trn-desc">{t.description}</p> : null}

        {/* ── Stages & locations ── */}
        {t.stages.length > 0 ? (
          <>
            <h2 className="trn-section-title">Stages &amp; locations</h2>
            <div className="trn-stages">
              {t.stages.map((s, i) => <StageCard key={s.id} stage={s} index={i} />)}
            </div>
          </>
        ) : t.venue ? (
          <>
            <h2 className="trn-section-title">Venue</h2>
            <div className="trn-stages">
              <div className="trn-stage-card">
                <div className="trn-stage-card__order">📍</div>
                <div className="trn-stage-card__body">
                  <h3 className="trn-stage-card__name">{t.venue.name}</h3>
                  <p className="trn-stage-card__where">
                    {t.venue.address_line1 ? `${t.venue.address_line1}, ` : ''}{t.venue.city}
                  </p>
                  <a
                    className="trn-stage-card__map"
                    href={mapsUrl(t.venue.lat, t.venue.lng, `${t.venue.name} ${t.venue.city}`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open in Google Maps ↗
                  </a>
                </div>
              </div>
            </div>
          </>
        ) : null}

        {/* ── Rules ── */}
        {t.rules ? (
          <div className="trn-rules">
            <button type="button" className="trn-rules__toggle" onClick={() => setRulesOpen((v) => !v)}>
              <h2 className="trn-section-title">Rules {rulesOpen ? '▾' : '▸'}</h2>
            </button>
            {rulesOpen ? <p className="muted trn-rules__body">{t.rules}</p> : null}
          </div>
        ) : null}

        {/* ── Podium ── */}
        {t.status === 'completed' && t.results.length > 0 ? (
          <>
            <h2 className="trn-section-title">Final standings</h2>
            <div className="trn-podium">
              {t.results.map((res) => (
                <div key={`${res.position}-${res.user_id}`} className={`trn-podium__row trn-podium__row--p${res.position}`}>
                  <span className="trn-podium__pos">{PODIUM_ICONS[res.position] ?? `#${res.position}`}</span>
                  <span className="trn-podium__name">{res.team_name || res.name}</span>
                  {res.points_earned > 0 ? <span className="trn-podium__pts">+{res.points_earned} pts</span> : null}
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* ── Bracket ── */}
        {t.status === 'live' || t.status === 'completed' ? (
          <div id="bracket">
            <h2 className="trn-section-title">Bracket</h2>
            <BracketView tournamentId={t.id} live={t.status === 'live'} myUserId={user?.id} />
          </div>
        ) : null}

        {/* ── Participants ── */}
        {t.participants.length > 0 ? (
          <>
            <h2 className="trn-section-title">Participants ({t.participants.length})</h2>
            <div className="trn-participants">
              {t.participants.map((p) => (
                <div key={p.user_id} className="trn-participant" title={p.team_name || p.name}>
                  {p.avatar_url ? (
                    <img className="trn-participant__avatar" src={p.avatar_url} alt="" />
                  ) : (
                    <span className="trn-participant__initial">{(p.team_name || p.name || '?')[0]?.toUpperCase()}</span>
                  )}
                  <span className="trn-participant__name">{p.team_name || p.name}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}

        {/* ── Sticky CTA ── */}
        <div className="trn-cta-sticky">{renderCta()}</div>

        {showModal ? (
          <RegisterModal
            tournament={t}
            waitlist={showModal === 'waitlist'}
            onClose={() => setShowModal(null)}
            onDone={(message) => {
              setShowModal(null);
              setNotice(message);
              load();
            }}
          />
        ) : null}
      </PageContainer>
    </section>
  );
}
