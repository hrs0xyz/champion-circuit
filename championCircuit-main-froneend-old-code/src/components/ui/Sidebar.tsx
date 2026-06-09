import { NavLink } from 'react-router-dom';

const adminLinks = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/turfs', label: 'Turfs & Slots' },
  { to: '/admin/tournaments', label: 'Tournaments' },
  { to: '/admin/leaderboard', label: 'Leaderboard' },
  { to: '/admin/users', label: 'Users & Teams' },
  { to: '/admin/content', label: 'Content' },
] as const;

export function AdminSidebar() {
  return (
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <div className="admin-sidebar__brand">
        <span className="admin-sidebar__title">CC Admin</span>
        <span className="admin-sidebar__sub">Internal</span>
      </div>
      <nav className="admin-sidebar__nav">
        {adminLinks.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={'end' in l ? l.end : false}
            className={({ isActive }) => `admin-sidebar__link${isActive ? ' is-active' : ''}`}
          >
            {l.label}
          </NavLink>
        ))}
      </nav>
      <NavLink to="/" className="admin-sidebar__exit">
        Exit to site
      </NavLink>
    </aside>
  );
}
