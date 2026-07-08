import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ccApi, type Venue, type Tournament, type NewsArticle } from '../../lib/ccApi';
import { ApiError } from '../../lib/api';
import { ActivityLogPage } from '../admin/ActivityLogPage';
import { CoverImagePicker, BodyEditor } from '../../components/ui/NewsEditor';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

async function adminReq<T>(path: string, init: RequestInit = {}): Promise<T> {
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

type Tab = 'dashboard' | 'users' | 'venues' | 'tournaments' | 'news' | 'vouchers' | 'activity';

interface Stats { total_users: number; total_venues: number; total_tournaments: number; total_matches: number; pending_matches: number; }
interface UserRow { id: number; username: string; email: string; name: string; city: string; is_admin: boolean; is_venue_owner: boolean; is_active: boolean; }

export function SuperAdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('dashboard');

  useEffect(() => {
    if (!user) navigate('/staff-login', { replace: true });
    else if (!user.is_admin) navigate('/staff/venue', { replace: true });
  }, [user, navigate]);

  if (!user?.is_admin) return null;

  return (
    <div className="staff-shell">
      <aside className="staff-sidebar">
        <div className="staff-sidebar__brand">
          <img src="/branding/cc-mark.png" alt="CC" width={32} />
          <span>Super Admin</span>
        </div>
        {(['dashboard','users','venues','tournaments','news','vouchers','activity'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`staff-nav-btn${tab === t ? ' staff-nav-btn--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'activity' ? '📊 Activity' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
        <button type="button" className="staff-nav-btn staff-nav-btn--logout"
          onClick={() => { signOut(); navigate('/staff-login'); }}>
          Sign out
        </button>
      </aside>
      <main className="staff-main">
        {tab === 'dashboard' && <AdminDashboard />}
        {tab === 'users' && <AdminUsers />}
        {tab === 'venues' && <AdminVenues />}
        {tab === 'tournaments' && <AdminTournaments />}
        {tab === 'news' && <AdminNews />}
        {tab === 'vouchers' && <AdminVouchersTab />}
        {tab === 'activity' && <ActivityLogPage />}
      </main>
    </div>
  );
}

// ── Dashboard stats ───────────────────────────────────────────────────────────
function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => { adminReq<Stats>('/api/admin/stats').then(setStats).catch(() => {}); }, []);
  if (!stats) return <div className="staff-loading">Loading…</div>;
  return (
    <div className="staff-section">
      <h2 className="staff-h2">Dashboard</h2>
      <div className="staff-stats-grid">
        {[
          { label: 'Users', value: stats.total_users, icon: '👥' },
          { label: 'Venues', value: stats.total_venues, icon: '🏟' },
          { label: 'Tournaments', value: stats.total_tournaments, icon: '🏆' },
          { label: 'Matches', value: stats.total_matches, icon: '⚽' },
          { label: 'Pending Matches', value: stats.pending_matches, icon: '⏳' },
        ].map((s) => (
          <div key={s.label} className="staff-stat-card">
            <span className="staff-stat-card__icon">{s.icon}</span>
            <span className="staff-stat-card__value">{s.value}</span>
            <span className="staff-stat-card__label">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────────
function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [search, setSearch] = useState('');
  const [msg, setMsg] = useState('');
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ username:'', email:'', password:'', name:'', is_venue_owner: false });

  const load = () => adminReq<UserRow[]>(`/api/admin/users?search=${encodeURIComponent(search)}&limit=100`).then(setUsers).catch(() => {});
  useEffect(() => { void load(); }, [search]);

  async function resetPw(userId: number, username: string) {
    const pw = prompt(`New password for @${username}:`);
    if (!pw) return;
    try {
      await adminReq(`/api/admin/users/${userId}/password`, { method: 'PUT', body: JSON.stringify({ new_password: pw }) });
      setMsg(`Password updated for @${username}`);
    } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
  }

  async function toggleActive(u: UserRow) {
    try {
      await adminReq(`/api/admin/users/${u.id}`, { method: 'PUT', body: JSON.stringify({ is_active: !u.is_active }) });
      void load();
    } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    try {
      await adminReq('/api/admin/users', { method: 'POST', body: JSON.stringify(newUser) });
      setCreating(false); setNewUser({ username:'',email:'',password:'',name:'',is_venue_owner:false }); void load();
    } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
  }

  return (
    <div className="staff-section">
      <div className="staff-section__header">
        <h2 className="staff-h2">Users</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancel' : '+ Create account'}
        </button>
      </div>
      {msg ? <p className="staff-msg">{msg}</p> : null}

      {creating && (
        <form className="staff-create-form" onSubmit={(e) => void handleCreate(e)}>
          <input className="auth-input" placeholder="Username" value={newUser.username} onChange={(e) => setNewUser({...newUser, username: e.target.value})} required />
          <input className="auth-input" placeholder="Email" type="email" value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})} required />
          <input className="auth-input" placeholder="Password" type="password" value={newUser.password} onChange={(e) => setNewUser({...newUser, password: e.target.value})} required />
          <input className="auth-input" placeholder="Name" value={newUser.name} onChange={(e) => setNewUser({...newUser, name: e.target.value})} />
          <label className="staff-checkbox"><input type="checkbox" checked={newUser.is_venue_owner} onChange={(e) => setNewUser({...newUser, is_venue_owner: e.target.checked})} /> Turf Owner</label>
          <button type="submit" className="btn btn-primary">Create</button>
        </form>
      )}

      <input className="auth-input" placeholder="Search username, email, name…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 16 }} />

      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead><tr><th>Username</th><th>Email</th><th>Roles</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>@{u.username}</td>
                <td>{u.email}</td>
                <td>
                  {u.is_admin && <span className="staff-badge staff-badge--admin">Admin</span>}
                  {u.is_venue_owner && <span className="staff-badge staff-badge--venue">Venue</span>}
                  {!u.is_admin && !u.is_venue_owner && <span className="staff-badge">User</span>}
                </td>
                <td><span className={`staff-badge ${u.is_active ? 'staff-badge--active' : 'staff-badge--inactive'}`}>{u.is_active ? 'Active' : 'Banned'}</span></td>
                <td className="staff-table__actions">
                  <button type="button" className="staff-action-btn" onClick={() => void resetPw(u.id, u.username)}>Reset pw</button>
                  <button type="button" className="staff-action-btn" onClick={() => void toggleActive(u)}>{u.is_active ? 'Ban' : 'Unban'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Venues tab ────────────────────────────────────────────────────────────────
function AdminVenues() {
  const [venues, setVenues] = useState<Venue[]>([]);
  const [msg, setMsg] = useState('');
  const load = () => adminReq<Venue[]>('/api/admin/venues').then(setVenues).catch(() => {});
  useEffect(() => { void load(); }, []);

  async function verify(id: number) {
    try { await adminReq(`/api/admin/venues/${id}/verify`, { method: 'POST' }); void load(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
  }
  async function toggle(id: number) {
    try { await adminReq(`/api/admin/venues/${id}/suspend`, { method: 'POST' }); void load(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
  }

  return (
    <div className="staff-section">
      <h2 className="staff-h2">Venues ({venues.length})</h2>
      {msg ? <p className="staff-msg">{msg}</p> : null}
      <div className="staff-table-wrap">
        <table className="staff-table">
          <thead><tr><th>Name</th><th>City</th><th>Verified</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            {venues.map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td>{v.city}</td>
                <td>{v.is_verified ? '✓' : '✗'}</td>
                <td>{v.is_active ? '✓' : '✗'}</td>
                <td className="staff-table__actions">
                  {!v.is_verified && <button type="button" className="staff-action-btn staff-action-btn--green" onClick={() => void verify(v.id)}>Verify</button>}
                  <button type="button" className="staff-action-btn" onClick={() => void toggle(v.id)}>{v.is_active ? 'Suspend' : 'Activate'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Tournaments tab ───────────────────────────────────────────────────────────
function AdminTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [assignUsername, setAssignUsername] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { ccApi.tournaments().then(setTournaments).catch(() => {}); }, []);

  async function assignAdmin(tId: number) {
    if (!assignUsername) return;
    try {
      await adminReq(`/api/admin/tournaments/${tId}/assign-match-admin`, { method: 'POST', body: JSON.stringify({ username: assignUsername }) });
      setAssigning(null); setAssignUsername(''); setMsg(`Assigned @${assignUsername} as match admin`);
    } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
  }

  async function updateStatus(tId: number, newStatus: string) {
    try {
      await adminReq(`/api/tournaments/${tId}`, { method: 'PUT', body: JSON.stringify({ status: newStatus }) });
      ccApi.tournaments().then(setTournaments).catch(() => {});
    } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
  }

  return (
    <div className="staff-section">
      <h2 className="staff-h2">Tournaments ({tournaments.length})</h2>
      {msg ? <p className="staff-msg">{msg}</p> : null}
      {tournaments.map((t) => (
        <div key={t.id} className="staff-card">
          <div className="staff-card__header">
            <div>
              <h3 className="staff-card__title">{t.name}</h3>
              <p className="staff-card__meta">{t.game} · {t.mode} · {t.participant_count}/{t.max_participants} players</p>
            </div>
            <span className="staff-badge">{t.status}</span>
          </div>
          <div className="staff-card__actions">
            <select className="auth-input" style={{ width: 160 }} value={t.status} onChange={(e) => void updateStatus(t.id, e.target.value)}>
              {['draft','registration','live','completed','cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAssigning(t.id)}>Assign match admin</button>
          </div>
          {assigning === t.id && (
            <div className="staff-inline-form">
              <input className="auth-input" placeholder="@username" value={assignUsername} onChange={(e) => setAssignUsername(e.target.value)} style={{ flex: 1 }} />
              <button type="button" className="btn btn-primary btn-sm" onClick={() => void assignAdmin(t.id)}>Assign</button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAssigning(null)}>Cancel</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── News tab ──────────────────────────────────────────────────────────────────
function AdminNews() {
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    title: '', summary: '', body: '', cover_url: '',
    category: 'esports', tags: '', is_published: false,
  });
  const [msg, setMsg] = useState('');

  const load = () =>
    adminReq<NewsArticle[]>('/api/admin/news').then(setArticles).catch(() => {});
  useEffect(() => { void load(); }, []);

  function openCreate() {
    setEditingId(null);
    setForm({ title: '', summary: '', body: '', cover_url: '', category: 'esports', tags: '', is_published: false });
    setCreating((v) => !v);
    setMsg('');
  }

  function openEdit(a: NewsArticle) {
    setCreating(true);
    setEditingId(a.id);
    setForm({
      title: a.title,
      summary: a.summary,
      body: a.body,
      cover_url: a.cover_url,
      category: a.category,
      tags: a.tags,
      is_published: a.is_published,
    });
    setMsg('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      if (editingId) {
        await adminReq(`/api/news/${editingId}`, { method: 'PUT', body: JSON.stringify(form) });
      } else {
        await ccApi.createNews(form);
      }
      setCreating(false);
      setEditingId(null);
      setForm({ title: '', summary: '', body: '', cover_url: '', category: 'esports', tags: '', is_published: false });
      setMsg('');
      void load();
    } catch (err) {
      const detail = err instanceof ApiError ? err.message : 'Failed to save article';
      setMsg(`Error: ${detail}`);
    }
  }

  async function publish(id: number) {
    try { await ccApi.publishNews(id); void load(); }
    catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
  }

  async function unpublish(id: number) {
    try {
      await adminReq(`/api/news/${id}`, { method: 'PUT', body: JSON.stringify({ is_published: false }) });
      void load();
    } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed'); }
  }

  async function deleteArticle(id: number, title: string) {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await adminReq(`/api/news/${id}`, { method: 'DELETE' });
      void load();
    } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed to delete'); }
  }

  return (
    <div className="staff-section">
      <div className="staff-section__header">
        <h2 className="staff-h2">News</h2>
        <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
          {creating && !editingId ? 'Cancel' : '+ New article'}
        </button>
      </div>
      {msg ? <p className={`staff-msg${msg.startsWith('Error:') ? ' staff-msg--err' : ''}`}>{msg}</p> : null}

      {creating && (
        <form className="news-form" onSubmit={(e) => void handleSubmit(e)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>
              {editingId ? 'Edit article' : 'New article'}
            </h3>
            <button type="button" className="staff-action-btn" onClick={() => { setCreating(false); setEditingId(null); }}>
              Cancel
            </button>
          </div>

          <div className="news-form__field">
            <label className="news-form__label">Cover image</label>
            <CoverImagePicker
              value={form.cover_url}
              onChange={(url) => setForm({ ...form, cover_url: url })}
            />
          </div>

          <div className="news-form__field">
            <label className="news-form__label">Title *</label>
            <input className="auth-input" placeholder="Article title" value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </div>

          <div className="news-form__field">
            <label className="news-form__label">Summary <span className="news-form__opt">(optional — shown in cards)</span></label>
            <input className="auth-input" placeholder="One-line teaser" value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })} />
          </div>

          <div className="news-form__row">
            <div className="news-form__field">
              <label className="news-form__label">Category</label>
              <select className="auth-input" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                {['esports', 'sports', 'general', 'announcement'].map((c) => (
                  <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="news-form__field">
              <label className="news-form__label">Tags <span className="news-form__opt">(comma separated)</span></label>
              <input className="auth-input" placeholder="e.g. bgmi, valorant, ipl" value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            </div>
          </div>

          <div className="news-form__field">
            <label className="news-form__label">Article body *</label>
            <BodyEditor
              initialValue={form.body}
              onChange={(html) => setForm({ ...form, body: html })}
            />
          </div>

          <div className="news-form__footer">
            <label className="staff-checkbox">
              <input type="checkbox" checked={form.is_published}
                onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
              Publish immediately
            </label>
            <button type="submit" className="btn btn-primary">
              {editingId ? 'Save changes' : 'Create article'}
            </button>
          </div>
        </form>
      )}

      <div className="staff-list">
        {articles.map((a) => (
          <div key={a.id} className="staff-card">
            <div className="staff-card__header">
              {a.cover_url && <img src={a.cover_url} alt="" className="news-list-thumb" />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 className="staff-card__title">{a.title}</h3>
                <p className="staff-card__meta">{a.category} · {a.view_count} views</p>
              </div>
              <span className={`staff-badge ${a.is_published ? 'staff-badge--active' : ''}`}>
                {a.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
            <div className="staff-card__actions">
              {!a.is_published && (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => void publish(a.id)}>
                  Publish
                </button>
              )}
              {a.is_published && (
                <button type="button" className="staff-action-btn" onClick={() => void unpublish(a.id)}>
                  Unpublish
                </button>
              )}
              <button type="button" className="staff-action-btn staff-action-btn--green"
                onClick={() => openEdit(a)}>
                Edit
              </button>
              <button type="button" className="staff-action-btn staff-action-btn--danger"
                onClick={() => void deleteArticle(a.id, a.title)}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Vouchers tab ──────────────────────────────────────────────────────────────
function AdminVouchersTab() {
  const [vouchers, setVouchers] = useState<Array<Record<string, unknown>>>([]);

  // Use ccApi browse
  useEffect(() => {
    import('../../lib/voucherApi').then(({ voucherApi }) => {
      voucherApi.browse().then((data) => setVouchers(data as unknown as Array<Record<string, unknown>>)).catch(() => {});
    });
  }, []);

  return (
    <div className="staff-section">
      <h2 className="staff-h2">Vouchers</h2>
      <p className="muted small">Voucher management coming in next update. Current listings:</p>
      <div className="staff-list">
        {(vouchers as Array<{ id: number; title: string; price_inr: number; sold_count: number; partner?: { name: string } }>).map((v) => (
          <div key={v.id} className="staff-card">
            <div className="staff-card__header">
              <div>
                <h3 className="staff-card__title">{v.title}</h3>
                <p className="staff-card__meta">{v.partner?.name} · ₹{v.price_inr} · {v.sold_count} sold</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
