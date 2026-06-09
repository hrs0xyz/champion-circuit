import { Link } from 'react-router-dom';
import { usePlatform } from '../../context/PlatformContext';

export function AdminDashboardPage() {
  const { turfs, tournaments, bookings } = usePlatform();
  return (
    <div className="admin-page">
      <h1>Dashboard</h1>
      <p className="muted">Manage turfs, tournaments, leaderboard, and site content.</p>
      <div className="admin-stat-grid">
        <div className="admin-stat">
          <span className="admin-stat__value">{turfs.length}</span>
          <span className="admin-stat__label">Turfs</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__value">{tournaments.length}</span>
          <span className="admin-stat__label">Tournaments</span>
        </div>
        <div className="admin-stat">
          <span className="admin-stat__value">{bookings.length}</span>
          <span className="admin-stat__label">Bookings (local)</span>
        </div>
      </div>
      <ul className="admin-quick-links">
        <li>
          <Link to="/admin/turfs">Turfs &amp; slots</Link>
        </li>
        <li>
          <Link to="/admin/tournaments">Tournaments</Link>
        </li>
        <li>
          <Link to="/admin/leaderboard">Leaderboard</Link>
        </li>
        <li>
          <Link to="/admin/content">Content</Link>
        </li>
      </ul>
    </div>
  );
}
