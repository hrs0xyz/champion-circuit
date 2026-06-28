/**
 * Admin Activity Log — shows user activity with filters + CSV export.
 * Accessible at /admin/activity (or embedded in SuperAdminPage).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const BASE = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

interface ActivityRow {
  id: number;
  user_id: number;
  username: string;
  event: string;
  venue_id: number | null;
  venue_name: string;
  sport: string;
  city: string;
  listing_id: number | null;
  listing_title: string;
  extra: string;
  created_at: string;
}

interface Summary {
  top_venues: { venue_name: string; venue_id: number; views: number }[];
  top_sports: { sport: string; clicks: number }[];
  top_cities: { city: string; selections: number }[];
  funnel: { venue_name: string; venue_id: number; views: number; inquiries: number }[];
  recent_users: { username: string; actions: number; last_seen: string }[];
}

const EVENT_LABELS: Record<string, string> = {
  venue_view: '👁 Venue view',
  venue_card_click: '🖱 Card click',
  listing_inquiry: '📩 Inquiry',
  sport_filter: '🎯 Sport filter',
  city_filter: '📍 City filter',
  voucher_view: '🎟 Voucher view',
  voucher_purchase: '💳 Purchase',
  booking: '📅 Booking',
};

const EVENT_COLOR: Record<string, string> = {
  venue_view: '#0abfbc',
  venue_card_click: '#38bdf8',
  listing_inquiry: '#4ade80',
  sport_filter: '#f59e0b',
  city_filter: '#a78bfa',
  voucher_purchase: '#fb923c',
  booking: '#34d399',
};

async function fetchApi<T>(path: string): Promise<T> {
  const token = localStorage.getItem('cc_token');
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function ActivityLogPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'log' | 'insights'>('insights');

  // Filters
  const [filterEvent, setFilterEvent] = useState('');
  const [filterSport, setFilterSport] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterUser, setFilterUser] = useState('');

  function buildQuery() {
    const p = new URLSearchParams({ limit: '200' });
    if (filterEvent) p.set('event', filterEvent);
    if (filterSport) p.set('sport', filterSport);
    if (filterCity) p.set('city', filterCity);
    if (filterUser) p.set('username', filterUser);
    return p.toString();
  }

  function load() {
    setLoading(true);
    Promise.all([
      fetchApi<{ total: number; rows: ActivityRow[] }>(`/api/admin/activity?${buildQuery()}`),
      fetchApi<Summary>('/api/admin/activity/summary'),
    ])
      .then(([data, sum]) => {
        setRows(data.rows);
        setTotal(data.total);
        setSummary(sum);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleExport() {
    const token = localStorage.getItem('cc_token');
    const url = `${BASE}/api/admin/activity/export`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'cc_activity.csv';
    // Trigger download with auth header via fetch then blob
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.blob())
      .then((blob) => {
        const objUrl = URL.createObjectURL(blob);
        a.href = objUrl;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      });
  }

  if (!user?.is_admin) {
    return <p style={{ padding: 40, color: '#f87171' }}>Admin access required.</p>;
  }

  return (
    <div className="activity-log-page">
      <div className="activity-log-page__head">
        <div>
          <h1 className="activity-log-page__title">User Activity Log</h1>
          <p className="activity-log-page__sub muted small">
            {total.toLocaleString()} total events tracked
          </p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport}>
          ⬇ Export CSV
        </button>
      </div>

      {/* Tabs */}
      <div className="bookings-tabs" style={{ marginBottom: 28 }}>
        <button
          type="button"
          className={`bookings-tab${tab === 'insights' ? ' bookings-tab--active' : ''}`}
          onClick={() => setTab('insights')}
        >
          📊 Insights
        </button>
        <button
          type="button"
          className={`bookings-tab${tab === 'log' ? ' bookings-tab--active' : ''}`}
          onClick={() => setTab('log')}
        >
          📋 Full Log
        </button>
      </div>

      {/* ── INSIGHTS TAB ── */}
      {tab === 'insights' && summary && (
        <div className="activity-insights">
          {/* Top venues */}
          <div className="activity-card">
            <h3 className="activity-card__title">🏟 Top Venues by Views</h3>
            <div className="activity-bar-list">
              {summary.top_venues.map((v) => (
                <div key={v.venue_id} className="activity-bar-row">
                  <span className="activity-bar-label">{v.venue_name || `Venue #${v.venue_id}`}</span>
                  <div className="activity-bar-track">
                    <div
                      className="activity-bar-fill"
                      style={{
                        width: `${Math.min(100, (v.views / (summary.top_venues[0]?.views || 1)) * 100)}%`,
                        background: '#0abfbc',
                      }}
                    />
                  </div>
                  <span className="activity-bar-value">{v.views}</span>
                </div>
              ))}
              {summary.top_venues.length === 0 && <p className="muted small">No data yet</p>}
            </div>
          </div>

          {/* Inquiry funnel */}
          <div className="activity-card">
            <h3 className="activity-card__title">📩 Views → Inquiries Funnel</h3>
            <table className="activity-table">
              <thead>
                <tr>
                  <th>Venue</th>
                  <th>Views</th>
                  <th>Inquiries</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {summary.funnel.map((f) => (
                  <tr key={f.venue_id}>
                    <td>{f.venue_name || `#${f.venue_id}`}</td>
                    <td>{f.views}</td>
                    <td>{f.inquiries}</td>
                    <td style={{ color: f.inquiries === 0 && f.views > 5 ? '#f87171' : '#4ade80' }}>
                      {f.views > 0 ? `${((f.inquiries / f.views) * 100).toFixed(0)}%` : '—'}
                      {f.inquiries === 0 && f.views > 5 ? ' ⚠' : ''}
                    </td>
                  </tr>
                ))}
                {summary.funnel.length === 0 && (
                  <tr><td colSpan={4} className="muted small">No data yet</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Top sports */}
          <div className="activity-card">
            <h3 className="activity-card__title">🎯 Top Sports Searched</h3>
            <div className="activity-bar-list">
              {summary.top_sports.map((s) => (
                <div key={s.sport} className="activity-bar-row">
                  <span className="activity-bar-label">{s.sport}</span>
                  <div className="activity-bar-track">
                    <div
                      className="activity-bar-fill"
                      style={{
                        width: `${Math.min(100, (s.clicks / (summary.top_sports[0]?.clicks || 1)) * 100)}%`,
                        background: '#f59e0b',
                      }}
                    />
                  </div>
                  <span className="activity-bar-value">{s.clicks}</span>
                </div>
              ))}
              {summary.top_sports.length === 0 && <p className="muted small">No data yet</p>}
            </div>
          </div>

          {/* Top cities */}
          <div className="activity-card">
            <h3 className="activity-card__title">📍 Top Cities</h3>
            <div className="activity-chip-list">
              {summary.top_cities.map((c) => (
                <span key={c.city} className="activity-chip">
                  {c.city} <strong>{c.selections}</strong>
                </span>
              ))}
              {summary.top_cities.length === 0 && <p className="muted small">No data yet</p>}
            </div>
          </div>

          {/* Recent active users */}
          <div className="activity-card">
            <h3 className="activity-card__title">👥 Most Active Users</h3>
            <table className="activity-table">
              <thead>
                <tr><th>Username</th><th>Actions</th><th>Last seen</th></tr>
              </thead>
              <tbody>
                {summary.recent_users.map((u) => (
                  <tr key={u.username}>
                    <td>@{u.username}</td>
                    <td>{u.actions}</td>
                    <td className="muted small">{new Date(u.last_seen).toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── FULL LOG TAB ── */}
      {tab === 'log' && (
        <>
          {/* Filters */}
          <div className="activity-filters">
            <select
              className="auth-input activity-filter-input"
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
            >
              <option value="">All events</option>
              {Object.entries(EVENT_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <input
              className="auth-input activity-filter-input"
              type="text"
              placeholder="Filter by sport…"
              value={filterSport}
              onChange={(e) => setFilterSport(e.target.value)}
            />
            <input
              className="auth-input activity-filter-input"
              type="text"
              placeholder="Filter by city…"
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
            />
            <input
              className="auth-input activity-filter-input"
              type="text"
              placeholder="Filter by username…"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
            />
            <button type="button" className="btn btn-primary btn-sm" onClick={load}>
              Apply
            </button>
          </div>

          {loading ? (
            <p className="muted small" style={{ padding: 20 }}>Loading…</p>
          ) : (
            <div className="activity-log-table-wrap">
              <table className="activity-table activity-table--full">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Event</th>
                    <th>Venue</th>
                    <th>Sport</th>
                    <th>City</th>
                    <th>Listing</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="muted small" style={{ whiteSpace: 'nowrap' }}>
                        {new Date(r.created_at).toLocaleString('en-IN', {
                          day: '2-digit', month: 'short',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </td>
                      <td>@{r.username}</td>
                      <td>
                        <span
                          className="activity-event-badge"
                          style={{ color: EVENT_COLOR[r.event] ?? '#fff' }}
                        >
                          {EVENT_LABELS[r.event] ?? r.event}
                        </span>
                      </td>
                      <td className="muted small">{r.venue_name || '—'}</td>
                      <td className="muted small">{r.sport || '—'}</td>
                      <td className="muted small">{r.city || '—'}</td>
                      <td className="muted small">{r.listing_title || '—'}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: 40 }} className="muted">
                        No activity yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
