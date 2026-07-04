/**
 * Turf Owner Dashboard — /staff/venue
 * Turf owner manages their venue: listings, bookings, tournaments, match admin assignment.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ccApi, type VenueListing, type Tournament } from '../../lib/ccApi';
import { ApiError } from '../../lib/api';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

async function staffReq<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('cc_token');
  const isForm = init.body instanceof FormData;
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(isForm ? {} : { 'Content-Type': 'application/json' }),
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

type Tab = 'overview' | 'listings' | 'bookings' | 'tournaments';

interface VenueData {
  venue: Record<string, unknown> | null;
  listings: VenueListing[];
  bookings: Record<string, unknown>[];
}

export function TurfOwnerPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<VenueData>({ venue: null, listings: [], bookings: [] });
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/staff-login', { replace: true }); return; }
    if (!user.is_venue_owner && !user.is_admin) { navigate('/staff/match', { replace: true }); return; }
    Promise.all([
      staffReq<VenueData>('/api/staff/my-venue'),
      staffReq<Tournament[]>('/api/staff/my-tournaments'),
    ]).then(([vd, ts]) => { setData(vd); setTournaments(ts); })
      .catch(() => setMsg('Could not load venue data.'))
      .finally(() => setLoading(false));
  }, [user, navigate]);

  if (!user?.is_venue_owner && !user?.is_admin) return null;

  const venueId = data.venue ? (data.venue as { id: number }).id : null;

  return (
    <div className="staff-shell">
      <aside className="staff-sidebar">
        <div className="staff-sidebar__brand">
          <img src="/branding/cc-mark.png" alt="CC" width={32} />
          <span>Venue Portal</span>
        </div>
        {(['overview', 'listings', 'bookings', 'tournaments'] as Tab[]).map((t) => (
          <button key={t} type="button"
            className={`staff-nav-btn${tab === t ? ' staff-nav-btn--active' : ''}`}
            onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
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
            {msg ? <p className="staff-msg">{msg}</p> : null}
            {tab === 'overview' && <VenueOverview data={data} />}
            {tab === 'listings' && venueId ? <VenueListings venueId={venueId} listings={data.listings} onMsg={setMsg} /> : null}
            {tab === 'bookings' && <VenueBookings bookings={data.bookings} />}
            {tab === 'tournaments' && <VenueTournaments tournaments={tournaments} onMsg={setMsg} venueId={venueId} />}
          </>
        )}
      </main>
    </div>
  );
}

function VenueOverview({ data }: { data: VenueData }) {
  const v = data.venue as Record<string, string | number | boolean> | null;
  if (!v) return (
    <div className="staff-section">
      <h2 className="staff-h2">My Venue</h2>
      <p className="muted">No venue yet. Contact super admin to set up your venue, or create one:</p>
      <a href="/api/docs#/venues/create_my_venue_api_venues_post" target="_blank" className="btn btn-secondary btn-sm" style={{ marginTop: 12 }}>
        Create via API docs →
      </a>
    </div>
  );
  return (
    <div className="staff-section">
      <h2 className="staff-h2">My Venue</h2>
      <div className="staff-venue-overview">
        <div className="staff-venue-overview__row"><span>Name</span><strong>{String(v.name)}</strong></div>
        <div className="staff-venue-overview__row"><span>City</span><strong>{String(v.city)}</strong></div>
        <div className="staff-venue-overview__row"><span>Address</span><strong>{String(v.address_line1)}</strong></div>
        <div className="staff-venue-overview__row"><span>Phone</span><strong>{String(v.phone)}</strong></div>
        <div className="staff-venue-overview__row"><span>Verified</span><strong>{v.is_verified ? '✓ Yes' : '✗ Pending'}</strong></div>
        <div className="staff-venue-overview__row"><span>Listings</span><strong>{data.listings.length}</strong></div>
        <div className="staff-venue-overview__row"><span>Bookings</span><strong>{data.bookings.length}</strong></div>
      </div>
    </div>
  );
}

function VenueListings({ venueId, listings, onMsg }: { venueId: number; listings: VenueListing[]; onMsg: (m: string) => void }) {
  const [cats, setCats] = useState<{ id: number; name: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ category_id: 0, title: '', description: '', capacity: 0, price_per_hour: 0, duration_minutes: 60, is_bookable: true, is_tournament_eligible: false });
  const [localListings, setLocal] = useState(listings);

  useEffect(() => { ccApi.categories().then(setCats).catch(() => {}); }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      const l = await ccApi.addListing(venueId, form);
      setLocal((prev) => [...prev, l]);
      setCreating(false);
      onMsg('Listing created.');
    } catch (err) { onMsg(err instanceof ApiError ? err.message : 'Failed'); }
  }

  return (
    <div className="staff-section">
      <div className="staff-section__header">
        <h2 className="staff-h2">Listings ({localListings.length})</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancel' : '+ Add listing'}
        </button>
      </div>
      {creating && (
        <form className="staff-create-form" onSubmit={(e) => void handleCreate(e)}>
          <select className="auth-input" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: Number(e.target.value) })} required>
            <option value={0}>Select category</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="auth-input" placeholder="Title (e.g. Cricket Turf A)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          <input className="auth-input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <input className="auth-input" type="number" placeholder="Capacity (players)" value={form.capacity || ''} onChange={(e) => setForm({ ...form, capacity: Number(e.target.value) })} />
          <input className="auth-input" type="number" placeholder="Price per hour (₹, 0=free)" value={form.price_per_hour / 100 || ''} onChange={(e) => setForm({ ...form, price_per_hour: Number(e.target.value) * 100 })} />
          <input className="auth-input" type="number" placeholder="Session duration (minutes)" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })} />
          <label className="staff-checkbox"><input type="checkbox" checked={form.is_bookable} onChange={(e) => setForm({ ...form, is_bookable: e.target.checked })} /> Bookable online</label>
          <label className="staff-checkbox"><input type="checkbox" checked={form.is_tournament_eligible} onChange={(e) => setForm({ ...form, is_tournament_eligible: e.target.checked })} /> Tournament eligible</label>
          <button type="submit" className="btn btn-primary">Create listing</button>
        </form>
      )}
      <div className="staff-list">
        {localListings.map((l) => (
          <div key={l.id} className="staff-card">
            <div className="staff-card__header">
              <div>
                <h3 className="staff-card__title">{l.title}</h3>
                <p className="staff-card__meta">{l.category.name} · {l.capacity} max · ₹{l.price_per_hour / 100}/hr · {l.photos.length}/5 photos</p>
              </div>
              <div className="staff-card__badges">
                {l.is_tournament_eligible && <span className="staff-badge staff-badge--active">Tournament</span>}
                {l.is_bookable && <span className="staff-badge">Bookable</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function VenueBookings({ bookings }: { bookings: Record<string, unknown>[] }) {
  type B = { id: number; listing_id: number; booking_date: string; start_time: string; end_time: string; status: string; user_id: number };
  const bs = bookings as B[];
  return (
    <div className="staff-section">
      <h2 className="staff-h2">Bookings ({bs.length})</h2>
      {bs.length === 0 ? <p className="muted">No bookings yet.</p> : (
        <div className="staff-table-wrap">
          <table className="staff-table">
            <thead><tr><th>Date</th><th>Time</th><th>Listing</th><th>User</th><th>Status</th></tr></thead>
            <tbody>
              {bs.map((b) => (
                <tr key={b.id}>
                  <td>{b.booking_date}</td>
                  <td>{b.start_time}–{b.end_time}</td>
                  <td>#{b.listing_id}</td>
                  <td>#{b.user_id}</td>
                  <td><span className={`staff-badge${b.status === 'confirmed' ? ' staff-badge--active' : ''}`}>{b.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function VenueTournaments({ tournaments, onMsg }: { tournaments: Tournament[]; onMsg: (m: string) => void; venueId: number | null }) {
  const [assigning, setAssigning] = useState<number | null>(null);
  const [username, setUsername] = useState('');

  async function assign(tId: number) {
    try {
      await staffReq(`/api/admin/tournaments/${tId}/assign-match-admin`, { method: 'POST', body: JSON.stringify({ username }) });
      setAssigning(null); setUsername('');
      onMsg(`@${username} assigned as match admin`);
    } catch (e) { onMsg(e instanceof ApiError ? e.message : 'Failed'); }
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
