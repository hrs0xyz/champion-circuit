/**
 * Turf Owner Dashboard — /staff/venue
 * Turf owners manage their venue end-to-end: venue details, listings (turfs),
 * photos, amenities, time slots, bookings, tournaments.
 * Every change is live immediately on the public /turf and /venue/:id pages.
 */
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ccApi, ApiError,
  type Category, type MyVenueData, type Tournament,
  type Venue, type VenueListing,
} from '../../lib/ccApi';

type Tab = 'overview' | 'venue' | 'listings' | 'bookings' | 'tournaments';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];

function slotDayLabel(dayOfWeek: number, specificDate: string): string {
  if (dayOfWeek >= 0 && dayOfWeek <= 6) return DAY_NAMES[dayOfWeek];
  return specificDate || 'Any day';
}

export function TurfOwnerPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<MyVenueData>({ venue: null });
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [msg, setMsg] = useState('');
  const [msgKind, setMsgKind] = useState<'ok' | 'err'>('ok');
  const [loading, setLoading] = useState(true);

  const notify = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    setMsg(text);
    setMsgKind(kind);
  }, []);

  const reload = useCallback(async () => {
    try {
      const [vd, ts] = await Promise.all([ccApi.myVenue(), ccApi.myTournaments()]);
      setData(vd);
      setTournaments(ts);
    } catch {
      notify('Saved, but refreshing the view failed — reload the page to see the latest.', 'err');
    }
  }, [notify]);

  useEffect(() => {
    if (!user) { navigate('/partner-login', { replace: true }); return; }
    if (!user.is_venue_owner && !user.is_admin) {
      // Match admins belong on the match portal; everyone else is blocked.
      navigate(user.is_match_admin ? '/staff/match' : '/partner-login', { replace: true });
      return;
    }
    Promise.all([reload(), ccApi.categories().then(setCats)])
      .catch(() => notify('Could not load venue data.', 'err'))
      .finally(() => setLoading(false));
  }, [user, navigate, reload, notify]);

  if (!user?.is_venue_owner && !user?.is_admin) return null;

  const venue = data.venue;
  const listings = data.listings ?? [];
  const bookings = data.bookings ?? [];

  return (
    <div className="staff-shell">
      <aside className="staff-sidebar">
        <div className="staff-sidebar__brand">
          <img src="/branding/cc-mark.png" alt="CC" width={32} />
          <span>Turf Owner Portal</span>
        </div>
        {(['overview', 'venue', 'listings', 'bookings', 'tournaments'] as Tab[]).map((t) => (
          <button key={t} type="button"
            className={`staff-nav-btn${tab === t ? ' staff-nav-btn--active' : ''}`}
            onClick={() => { setTab(t); setMsg(''); }}>
            {t === 'venue' ? 'My Venue' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        {user.is_admin && (
          <button type="button" className="staff-nav-btn" onClick={() => navigate('/staff/admin')}>
            ← Super Admin
          </button>
        )}
        <button type="button" className="staff-nav-btn staff-nav-btn--logout"
          onClick={() => { signOut(); navigate('/staff-login'); }}>
          Sign out
        </button>
      </aside>

      <main className="staff-main">
        {loading ? <div className="staff-loading">Loading venue…</div> : (
          <>
            {msg ? <p className={msgKind === 'err' ? 'auth-error' : 'auth-success'}>{msg}</p> : null}
            {tab === 'overview' && <VenueOverview venue={venue} listings={listings} bookings={bookings} goTo={setTab} />}
            {tab === 'venue' && (
              <VenueEditor venue={venue} onSaved={() => { void reload(); }} onMsg={notify} />
            )}
            {tab === 'listings' && (
              venue
                ? <ListingsPanel venueId={venue.id} listings={listings} cats={cats}
                    onChanged={() => { void reload(); }} onMsg={notify} />
                : <NoVenueYet goTo={setTab} />
            )}
            {tab === 'bookings' && (
              <BookingsPanel bookings={bookings} listings={listings}
                onChanged={() => { void reload(); }} onMsg={notify} />
            )}
            {tab === 'tournaments' && <VenueTournaments tournaments={tournaments} onMsg={notify} />}
          </>
        )}
      </main>
    </div>
  );
}

function NoVenueYet({ goTo }: { goTo: (t: Tab) => void }) {
  return (
    <div className="staff-section">
      <h2 className="staff-h2">No venue yet</h2>
      <p className="muted">Set up your venue first — then add your turfs and courts here.</p>
      <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}
        onClick={() => goTo('venue')}>
        Set up my venue →
      </button>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function VenueOverview({ venue, listings, bookings, goTo }: {
  venue: Venue | null;
  listings: VenueListing[];
  bookings: NonNullable<MyVenueData['bookings']>;
  goTo: (t: Tab) => void;
}) {
  if (!venue) return <NoVenueYet goTo={goTo} />;

  const activeCount = listings.filter((l) => l.is_active).length;
  const pendingCount = bookings.filter((b) => b.status === 'pending').length;
  // Venue's sports are derived from its listings' categories (auto, never stale).
  const sports = [...new Set(listings.map((l) => l.category?.name).filter(Boolean))] as string[];

  return (
    <div className="staff-section">
      <div className="staff-section__header">
        <h2 className="staff-h2">{venue.name}</h2>
        <Link to={`/venue/${venue.id}`} target="_blank" className="btn btn-secondary btn-sm">
          View public page ↗
        </Link>
      </div>

      <div className="staff-stats-grid">
        <div className="staff-stat-card">
          <div className="staff-stat-card__icon">🏟️</div>
          <div className="staff-stat-card__value">{listings.length}</div>
          <div className="staff-stat-card__label">Listings</div>
        </div>
        <div className="staff-stat-card">
          <div className="staff-stat-card__icon">✅</div>
          <div className="staff-stat-card__value">{activeCount}</div>
          <div className="staff-stat-card__label">Live listings</div>
        </div>
        <div className="staff-stat-card">
          <div className="staff-stat-card__icon">📅</div>
          <div className="staff-stat-card__value">{bookings.length}</div>
          <div className="staff-stat-card__label">Bookings</div>
        </div>
        <div className="staff-stat-card">
          <div className="staff-stat-card__icon">⏳</div>
          <div className="staff-stat-card__value">{pendingCount}</div>
          <div className="staff-stat-card__label">Pending</div>
        </div>
      </div>

      {sports.length > 0 && (
        <div className="staff-chip-row" style={{ marginTop: 20 }}>
          <span className="staff-subsection__title" style={{ marginRight: 4 }}>Sports offered</span>
          {sports.map((s) => <span key={s} className="staff-chip">{s}</span>)}
        </div>
      )}

      <div className="staff-venue-overview" style={{ marginTop: 16 }}>
        <div className="staff-venue-overview__row"><span>City</span><strong>{venue.city || '—'}</strong></div>
        <div className="staff-venue-overview__row"><span>Address</span><strong>{[venue.address_line1, venue.address_line2].filter(Boolean).join(', ') || '—'}</strong></div>
        <div className="staff-venue-overview__row"><span>Phone</span><strong>{venue.phone || '—'}</strong></div>
        <div className="staff-venue-overview__row">
          <span>Website</span>
          <strong>{venue.website
            ? <a href={venue.website} target="_blank" rel="noreferrer" className="auth-label-link">{venue.website}</a>
            : '—'}</strong>
        </div>
        <div className="staff-venue-overview__row">
          <span>Verified</span>
          <strong>{venue.is_verified ? '✓ Yes' : '✗ Pending review'}</strong>
        </div>
        <div className="staff-venue-overview__row">
          <span>Status</span>
          <strong>{venue.is_active ? 'Active' : 'Suspended'}</strong>
        </div>
      </div>

      <p className="muted" style={{ marginTop: 16, fontSize: 13 }}>
        Changes you make here are live immediately on the public Turf pages.
      </p>
    </div>
  );
}

// ── Venue create / edit ───────────────────────────────────────────────────────

const EMPTY_VENUE_FORM = {
  name: '', description: '', phone: '', email: '', website: '',
  address_line1: '', address_line2: '', city: '', state: '', postal_code: '',
  logo_url: '', cover_url: '',
};

type VenueForm = typeof EMPTY_VENUE_FORM;

function VenueEditor({ venue, onSaved, onMsg }: {
  venue: Venue | null;
  onSaved: () => void;
  onMsg: (m: string, kind?: 'ok' | 'err') => void;
}) {
  const [form, setForm] = useState<VenueForm>(EMPTY_VENUE_FORM);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (venue) {
      setForm({
        name: venue.name ?? '', description: venue.description ?? '',
        phone: venue.phone ?? '', email: venue.email ?? '', website: venue.website ?? '',
        address_line1: venue.address_line1 ?? '', address_line2: venue.address_line2 ?? '',
        city: venue.city ?? '', state: venue.state ?? '', postal_code: venue.postal_code ?? '',
        logo_url: venue.logo_url ?? '', cover_url: venue.cover_url ?? '',
      });
    }
  }, [venue]);

  const set = (key: keyof VenueForm) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) { onMsg('Venue name must be at least 2 characters.', 'err'); return; }
    setSaving(true);
    try {
      if (venue) {
        await ccApi.updateVenue(venue.id, form);
        onMsg('Venue updated — changes are live.');
      } else {
        await ccApi.createVenue(form);
        onMsg('Venue created! Now add your first listing.');
      }
      onSaved();
    } catch (err) {
      onMsg(err instanceof ApiError ? err.message : 'Save failed.', 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="staff-section">
      <h2 className="staff-h2">{venue ? 'Edit venue details' : 'Set up your venue'}</h2>
      <form className="staff-create-form" onSubmit={(e) => void handleSubmit(e)}>
        <div className="staff-form-grid">
          <label className="auth-label">Venue name *
            <input className="auth-input" value={form.name} onChange={set('name')} required minLength={2} placeholder="e.g. Champion Sports Arena" />
          </label>
          <label className="auth-label">Phone
            <input className="auth-input" value={form.phone} onChange={set('phone')} placeholder="+91 …" />
          </label>
          <label className="auth-label">Email
            <input className="auth-input" type="email" value={form.email} onChange={set('email')} placeholder="contact@venue.com" />
          </label>
          <label className="auth-label">Website
            <input className="auth-input" value={form.website} onChange={set('website')} placeholder="https://…" />
          </label>
          <label className="auth-label">Address line 1
            <input className="auth-input" value={form.address_line1} onChange={set('address_line1')} />
          </label>
          <label className="auth-label">Address line 2
            <input className="auth-input" value={form.address_line2} onChange={set('address_line2')} />
          </label>
          <label className="auth-label">City
            <input className="auth-input" value={form.city} onChange={set('city')} />
          </label>
          <label className="auth-label">State
            <input className="auth-input" value={form.state} onChange={set('state')} />
          </label>
          <label className="auth-label">Postal code
            <input className="auth-input" value={form.postal_code} onChange={set('postal_code')} />
          </label>
          <label className="auth-label">Logo URL
            <input className="auth-input" value={form.logo_url} onChange={set('logo_url')} placeholder="https://…/logo.png" />
          </label>
          <label className="auth-label">Cover image URL
            <input className="auth-input" value={form.cover_url} onChange={set('cover_url')} placeholder="https://…/cover.jpg" />
          </label>
        </div>
        <label className="auth-label">Description
          <textarea className="auth-input" rows={4} value={form.description} onChange={set('description')}
            placeholder="Tell players what makes your venue great…" />
        </label>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : venue ? 'Save changes' : 'Create venue'}
        </button>
      </form>
    </div>
  );
}

// ── Listings (turfs) ──────────────────────────────────────────────────────────

function ListingsPanel({ venueId, listings, cats, onChanged, onMsg }: {
  venueId: number;
  listings: VenueListing[];
  cats: Category[];
  onChanged: () => void;
  onMsg: (m: string, kind?: 'ok' | 'err') => void;
}) {
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const emptyForm = {
    category_id: 0, title: '', description: '', capacity: '',
    price_per_hour: 0, duration_minutes: 60, is_bookable: true, is_tournament_eligible: false,
  };
  const [form, setForm] = useState(emptyForm);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (!form.category_id) { onMsg('Pick a category for the listing.', 'err'); return; }
    if (form.capacity && !/^\d{1,6}(-\d{1,6})?$/.test(form.capacity.trim())) {
      onMsg('Capacity must be a number (e.g. 10) or a range (e.g. 5-10).', 'err'); return;
    }
    setSaving(true);
    try {
      await ccApi.addListing(venueId, { ...form, capacity: form.capacity.trim() });
      setCreating(false);
      setForm(emptyForm);
      onMsg('Listing created — it is now visible to players.');
      onChanged();
    } catch (err) {
      onMsg(err instanceof ApiError ? err.message : 'Failed to create listing.', 'err');
    } finally {
      setSaving(false);
    }
  }

  const sports = [...new Set(listings.map((l) => l.category?.name).filter(Boolean))] as string[];

  return (
    <div className="staff-section">
      <div className="staff-section__header">
        <h2 className="staff-h2">Listings ({listings.length})</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancel' : '+ Add listing'}
        </button>
      </div>

      {sports.length > 0 && (
        <div className="staff-chip-row" style={{ marginBottom: 16 }}>
          <span className="staff-subsection__title" style={{ marginRight: 4 }}>Categories</span>
          {sports.map((s) => <span key={s} className="staff-chip">{s}</span>)}
        </div>
      )}

      {creating && (
        <form className="staff-create-form" onSubmit={(e) => void handleCreate(e)}>
          <div className="staff-form-grid">
            <label className="auth-label">Category *
              <select className="auth-input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })} required>
                <option value={0}>Select category</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="auth-label">Title *
              <input className="auth-input" placeholder="e.g. Cricket Turf A" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={2} />
            </label>
            <label className="auth-label">Capacity (players)
              <input className="auth-input" inputMode="numeric" pattern="\d{1,6}(-\d{1,6})?" placeholder="e.g. 10 or 5-10 (optional)" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} title="A number (10) or a range (5-10)" />
            </label>
            <label className="auth-label">Price per hour (₹)
              <input className="auth-input" inputMode="numeric" placeholder="0 = free" value={form.price_per_hour ? String(form.price_per_hour / 100) : ''} onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ''); setForm({ ...form, price_per_hour: d ? parseInt(d, 10) * 100 : 0 }); }} />
            </label>
            <label className="auth-label">Session duration (minutes)
              <input className="auth-input" inputMode="numeric" value={form.duration_minutes ? String(form.duration_minutes) : ''} onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ''); setForm({ ...form, duration_minutes: d ? parseInt(d, 10) : 0 }); }} />
            </label>
          </div>
          <label className="auth-label">Description
            <input className="auth-input" placeholder="Short description players will see" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="staff-inline-form" style={{ flexWrap: 'wrap' }}>
            <label className="staff-checkbox"><input type="checkbox" checked={form.is_bookable} onChange={(e) => setForm({ ...form, is_bookable: e.target.checked })} /> Bookable online</label>
            <label className="staff-checkbox"><input type="checkbox" checked={form.is_tournament_eligible} onChange={(e) => setForm({ ...form, is_tournament_eligible: e.target.checked })} /> Tournament eligible</label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating…' : 'Create listing'}</button>
        </form>
      )}

      <div className="staff-list">
        {listings.length === 0 && !creating ? (
          <p className="muted">No listings yet. Add your first turf or court above.</p>
        ) : listings.map((l) => (
          <ListingCard key={l.id} listing={l} cats={cats}
            expanded={expandedId === l.id}
            onToggle={() => setExpandedId((id) => (id === l.id ? null : l.id))}
            onChanged={onChanged} onMsg={onMsg} />
        ))}
      </div>
    </div>
  );
}

function ListingCard({ listing, cats, expanded, onToggle, onChanged, onMsg }: {
  listing: VenueListing;
  cats: Category[];
  expanded: boolean;
  onToggle: () => void;
  onChanged: () => void;
  onMsg: (m: string, kind?: 'ok' | 'err') => void;
}) {
  return (
    <div className="staff-card">
      <div className="staff-card__header">
        <div>
          <h3 className="staff-card__title">{listing.title}</h3>
          <p className="staff-card__meta">
            {listing.category?.name ?? '—'}{listing.capacity ? ` · ${listing.capacity} players` : ''} · ₹{listing.price_per_hour / 100}/hr · {listing.photos.length}/5 photos · {listing.slots.length} slots
          </p>
        </div>
        <div className="staff-card__badges">
          {!listing.is_active && <span className="staff-badge staff-badge--warn">Hidden</span>}
          {listing.is_tournament_eligible && <span className="staff-badge staff-badge--active">Tournament</span>}
          {listing.is_bookable && <span className="staff-badge">Bookable</span>}
          <button type="button" className="btn btn-ghost btn-sm" onClick={onToggle}>
            {expanded ? 'Close' : 'Edit'}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="staff-listing-editor">
          <ListingEditForm listing={listing} cats={cats} onChanged={onChanged} onMsg={onMsg} />
          <PhotoManager listing={listing} onChanged={onChanged} onMsg={onMsg} />
          <AmenityEditor listing={listing} onChanged={onChanged} onMsg={onMsg} />
          <SlotManager listing={listing} onChanged={onChanged} onMsg={onMsg} />
        </div>
      )}
    </div>
  );
}

function ListingEditForm({ listing, cats, onChanged, onMsg }: {
  listing: VenueListing;
  cats: Category[];
  onChanged: () => void;
  onMsg: (m: string, kind?: 'ok' | 'err') => void;
}) {
  const [form, setForm] = useState({
    category_id: listing.category?.id ?? 0,
    title: listing.title,
    description: listing.description,
    rules: listing.rules,
    capacity: listing.capacity,
    price_per_hour: listing.price_per_hour,
    price_per_session: listing.price_per_session,
    duration_minutes: listing.duration_minutes,
    is_bookable: listing.is_bookable,
    is_tournament_eligible: listing.is_tournament_eligible,
    is_active: listing.is_active,
  });
  const [saving, setSaving] = useState(false);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (form.capacity && !/^\d{1,6}(-\d{1,6})?$/.test(form.capacity.trim())) {
      onMsg('Capacity must be a number (e.g. 10) or a range (e.g. 5-10).', 'err'); return;
    }
    setSaving(true);
    try {
      await ccApi.updateListing(listing.id, { ...form, capacity: form.capacity.trim() });
      onMsg('Listing updated — changes are live.');
      onChanged();
    } catch (err) {
      onMsg(err instanceof ApiError ? err.message : 'Update failed.', 'err');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="staff-subsection" onSubmit={(e) => void handleSave(e)}>
      <h4 className="staff-subsection__title">Details</h4>
      <div className="staff-form-grid">
        <label className="auth-label">Title
          <input className="auth-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required minLength={2} />
        </label>
        <label className="auth-label">Category
          <select className="auth-input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="auth-label">Capacity (players)
          <input className="auth-input" inputMode="numeric" pattern="\d{1,6}(-\d{1,6})?" placeholder="e.g. 10 or 5-10" title="A number (10) or a range (5-10)" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
        </label>
        <label className="auth-label">Price / hour (₹)
          <input className="auth-input" inputMode="numeric" value={form.price_per_hour ? String(form.price_per_hour / 100) : ''} onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ''); setForm({ ...form, price_per_hour: d ? parseInt(d, 10) * 100 : 0 }); }} />
        </label>
        <label className="auth-label">Price / session (₹)
          <input className="auth-input" inputMode="numeric" value={form.price_per_session ? String(form.price_per_session / 100) : ''} onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ''); setForm({ ...form, price_per_session: d ? parseInt(d, 10) * 100 : 0 }); }} />
        </label>
        <label className="auth-label">Duration (minutes)
          <input className="auth-input" inputMode="numeric" value={form.duration_minutes ? String(form.duration_minutes) : ''} onChange={(e) => { const d = e.target.value.replace(/[^0-9]/g, ''); setForm({ ...form, duration_minutes: d ? parseInt(d, 10) : 0 }); }} />
        </label>
      </div>
      <label className="auth-label">Description
        <textarea className="auth-input" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </label>
      <label className="auth-label">Rules
        <textarea className="auth-input" rows={2} value={form.rules} onChange={(e) => setForm({ ...form, rules: e.target.value })} placeholder="e.g. Studs not allowed, arrive 10 min early" />
      </label>
      <div className="staff-inline-form" style={{ flexWrap: 'wrap' }}>
        <label className="staff-checkbox"><input type="checkbox" checked={form.is_bookable} onChange={(e) => setForm({ ...form, is_bookable: e.target.checked })} /> Bookable online</label>
        <label className="staff-checkbox"><input type="checkbox" checked={form.is_tournament_eligible} onChange={(e) => setForm({ ...form, is_tournament_eligible: e.target.checked })} /> Tournament eligible</label>
        <label className="staff-checkbox"><input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} /> Visible to players</label>
      </div>
      <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
        {saving ? 'Saving…' : 'Save details'}
      </button>
    </form>
  );
}

function PhotoManager({ listing, onChanged, onMsg }: {
  listing: VenueListing;
  onChanged: () => void;
  onMsg: (m: string, kind?: 'ok' | 'err') => void;
}) {
  const [uploading, setUploading] = useState(false);

  async function handleUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { onMsg('Image must be 5 MB or smaller.', 'err'); return; }
    setUploading(true);
    try {
      await ccApi.uploadListingPhoto(listing.id, file, listing.photos.length + 1);
      onMsg('Photo uploaded.');
      onChanged();
    } catch (err) {
      onMsg(err instanceof ApiError ? err.message : 'Upload failed.', 'err');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(photoId: number) {
    try {
      await ccApi.deleteListingPhoto(listing.id, photoId);
      onMsg('Photo removed.');
      onChanged();
    } catch (err) {
      onMsg(err instanceof ApiError ? err.message : 'Delete failed.', 'err');
    }
  }

  return (
    <div className="staff-subsection">
      <h4 className="staff-subsection__title">Photos ({listing.photos.length}/5)</h4>
      <div className="staff-photo-grid">
        {listing.photos.map((p) => (
          <div key={p.id} className="staff-photo">
            <img src={p.url} alt={p.caption || listing.title} loading="lazy" />
            <button type="button" className="staff-photo__del" title="Remove photo"
              onClick={() => void handleDelete(p.id)}>×</button>
          </div>
        ))}
        {listing.photos.length < 5 && (
          <label className={`staff-photo staff-photo--add${uploading ? ' staff-photo--busy' : ''}`}>
            <input type="file" accept="image/jpeg,image/png,image/webp" hidden
              onChange={(e) => void handleUpload(e)} disabled={uploading} />
            {uploading ? 'Uploading…' : '+ Add photo'}
          </label>
        )}
      </div>
    </div>
  );
}

function AmenityEditor({ listing, onChanged, onMsg }: {
  listing: VenueListing;
  onChanged: () => void;
  onMsg: (m: string, kind?: 'ok' | 'err') => void;
}) {
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(labels: string[]) {
    if (busy) return;
    setBusy(true);
    try {
      await ccApi.setAmenities(listing.id, labels);
      onMsg('Amenities updated.');
      onChanged();
    } catch (err) {
      onMsg(err instanceof ApiError ? err.message : 'Update failed.', 'err');
    } finally {
      setBusy(false);
    }
  }

  function handleAdd(e: FormEvent) {
    e.preventDefault();
    const label = draft.trim();
    if (!label) return;
    if (listing.amenities.some((a) => a.toLowerCase() === label.toLowerCase())) {
      setDraft('');
      return;
    }
    setDraft('');
    void save([...listing.amenities, label]);
  }

  return (
    <div className="staff-subsection">
      <h4 className="staff-subsection__title">Amenities</h4>
      <div className="staff-chip-row">
        {listing.amenities.length === 0 && <span className="muted" style={{ fontSize: 13 }}>None yet — add Floodlit, Parking, WiFi…</span>}
        {listing.amenities.map((a) => (
          <span key={a} className="staff-chip">
            {a}
            <button type="button" className="staff-chip__x" title={`Remove ${a}`} disabled={busy}
              onClick={() => void save(listing.amenities.filter((x) => x !== a))}>×</button>
          </span>
        ))}
      </div>
      <form className="staff-inline-form" onSubmit={handleAdd}>
        <input className="auth-input" placeholder="Add amenity (e.g. Floodlit)" value={draft}
          onChange={(e) => setDraft(e.target.value)} style={{ flex: 1 }} maxLength={100} disabled={busy} />
        <button type="submit" className="btn btn-secondary btn-sm" disabled={busy}>Add</button>
      </form>
    </div>
  );
}

function SlotManager({ listing, onChanged, onMsg }: {
  listing: VenueListing;
  onChanged: () => void;
  onMsg: (m: string, kind?: 'ok' | 'err') => void;
}) {
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ day_of_week: 0, start_time: '18:00', end_time: '19:00', max_bookings: 1 });

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    if (form.end_time <= form.start_time) { onMsg('End time must be after start time.', 'err'); return; }
    setSaving(true);
    try {
      await ccApi.addSlot(listing.id, form);
      setAdding(false);
      onMsg('Slot added.');
      onChanged();
    } catch (err) {
      onMsg(err instanceof ApiError ? err.message : 'Failed to add slot.', 'err');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(slotId: number) {
    try {
      await ccApi.deleteSlot(listing.id, slotId);
      onMsg('Slot removed.');
      onChanged();
    } catch (err) {
      onMsg(err instanceof ApiError ? err.message : 'Delete failed.', 'err');
    }
  }

  return (
    <div className="staff-subsection">
      <div className="staff-section__header">
        <h4 className="staff-subsection__title">Weekly time slots ({listing.slots.length})</h4>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : '+ Add slot'}
        </button>
      </div>

      {adding && (
        <form className="staff-inline-form" onSubmit={(e) => void handleAdd(e)} style={{ flexWrap: 'wrap' }}>
          <select className="auth-input" value={form.day_of_week}
            onChange={(e) => setForm({ ...form, day_of_week: Number(e.target.value) })}>
            {DAY_NAMES.map((d, i) => <option key={d} value={i}>{d}</option>)}
          </select>
          <input className="auth-input" type="time" value={form.start_time}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
          <input className="auth-input" type="time" value={form.end_time}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
          <input className="auth-input" type="number" min={1} title="Max bookings" value={form.max_bookings}
            onChange={(e) => setForm({ ...form, max_bookings: Number(e.target.value) })} style={{ width: 90 }} />
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Adding…' : 'Add'}</button>
        </form>
      )}

      {listing.slots.length === 0 ? (
        <p className="muted" style={{ fontSize: 13 }}>No slots yet — add bookable time windows.</p>
      ) : (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead><tr><th>Day</th><th>Time</th><th>Max bookings</th><th></th></tr></thead>
            <tbody>
              {listing.slots.map((s) => (
                <tr key={s.id}>
                  <td>{slotDayLabel(s.day_of_week, s.specific_date)}</td>
                  <td>{s.start_time}–{s.end_time}</td>
                  <td>{s.max_bookings}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => void handleDelete(s.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Bookings ──────────────────────────────────────────────────────────────────

function BookingsPanel({ bookings, listings, onChanged, onMsg }: {
  bookings: NonNullable<MyVenueData['bookings']>;
  listings: VenueListing[];
  onChanged: () => void;
  onMsg: (m: string, kind?: 'ok' | 'err') => void;
}) {
  // Optimistic status overrides so the <select> doesn't snap back to the old
  // value during the save + reload round trip.
  const [pending, setPending] = useState<Record<number, string>>({});

  const titleOf = (listingId: number) =>
    listings.find((l) => l.id === listingId)?.title ?? `#${listingId}`;

  async function handleStatus(bookingId: number, status: string) {
    setPending((p) => ({ ...p, [bookingId]: status }));
    try {
      await ccApi.updateBookingStatus(bookingId, status);
      onMsg(`Booking #${bookingId} marked ${status}.`);
      onChanged();
    } catch (err) {
      setPending((p) => { const next = { ...p }; delete next[bookingId]; return next; });
      onMsg(err instanceof ApiError ? err.message : 'Status update failed.', 'err');
    }
  }

  return (
    <div className="staff-section">
      <h2 className="staff-h2">Bookings ({bookings.length})</h2>
      {bookings.length === 0 ? <p className="muted">No bookings yet.</p> : (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead><tr><th>Date</th><th>Time</th><th>Listing</th><th>User</th><th>Status</th></tr></thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.booking_date}</td>
                  <td>{b.start_time}–{b.end_time}</td>
                  <td>{titleOf(b.listing_id)}</td>
                  <td>{b.user_id ? `#${b.user_id}` : '—'}</td>
                  <td>
                    <select className="auth-input staff-status-select" value={pending[b.id] ?? b.status}
                      onChange={(e) => void handleStatus(b.id, e.target.value)}>
                      {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Tournaments ───────────────────────────────────────────────────────────────

function VenueTournaments({ tournaments, onMsg }: {
  tournaments: Tournament[];
  onMsg: (m: string, kind?: 'ok' | 'err') => void;
}) {
  const [assigning, setAssigning] = useState<number | null>(null);
  const [username, setUsername] = useState('');

  async function assign(tId: number) {
    try {
      await ccApi.assignMatchAdmin(tId, username);
      setAssigning(null); setUsername('');
      onMsg(`@${username} assigned as match admin.`);
    } catch (e) { onMsg(e instanceof ApiError ? e.message : 'Failed.', 'err'); }
  }

  return (
    <div className="staff-section">
      <h2 className="staff-h2">Tournaments ({tournaments.length})</h2>
      {tournaments.length === 0 ? (
        <p className="muted">No tournaments at your venue yet. Create one via the API or ask super admin.</p>
      ) : tournaments.map((t) => (
        <div key={t.id} className="staff-card">
          <div className="staff-card__header">
            <div>
              <h3 className="staff-card__title">{t.name}</h3>
              <p className="staff-card__meta">{t.game} · {t.participant_count}/{t.max_participants} · {t.status}</p>
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAssigning(t.id)}>
              Assign match admin
            </button>
          </div>
          {assigning === t.id && (
            <div className="staff-inline-form">
              <input className="auth-input" placeholder="@username" value={username} onChange={(e) => setUsername(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void assign(t.id)}>Assign</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAssigning(null)}>Cancel</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
