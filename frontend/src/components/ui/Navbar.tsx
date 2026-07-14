import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const MOBILE_MENU_ID = 'site-mobile-navigation';

type NavItem = {
  to: string;
  label: string;
  /** When true the link is only rendered for authenticated users. */
  requiresAuth?: boolean;
};

const NAV_LINKS: readonly NavItem[] = [
  { to: '/turf', label: 'Turf' },
  { to: '/esports', label: 'Esports' },
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/vouchers', label: 'Shop' },
  { to: '/leaderboard', label: 'Leaderboard', requiresAuth: true },
  { to: '/news', label: 'News' },
  { to: '/about', label: 'About' },
];

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000';

function avatarSrc(url: string | undefined) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${BASE_URL}${url}`;
}

type NavbarProps = {
  variant: 'public' | 'app';
};

export function Navbar({ variant }: NavbarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const displayName = user?.name || user?.username || 'Account';
  const initial = (displayName[0] ?? 'C').toUpperCase();
  const avatarUrl = avatarSrc(user?.avatar_url || user?.photo_url);

  // Auth-gated links (e.g. Leaderboard) are only shown once a user is signed in.
  const navLinks = NAV_LINKS.filter((l) => !l.requiresAuth || Boolean(user));

  const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'nav-link is-active' : 'nav-link');

  function handleSignOut() {
    setMenuOpen(false);
    signOut();
    navigate('/');
  }

  return (
    <>
      <header className="site-header">
        <div className="site-header-glass">
          <Link className="brand brand-wide" to="/" onClick={close} title="Champion Circuit">
            <img src="/branding/cc-full.png" alt="Champion Circuit" width={220} height={56} className="brand-mark-wide" decoding="async" />
            <span className="brand-sr">Champion Circuit, home</span>
          </Link>
          <nav className="nav-glass" aria-label="Site">
            {navLinks.map((l) => (
              <NavLink key={l.to} to={l.to} className={navClass} onClick={close}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          {variant === 'public' ? (
            <div className="nav-actions">
              <Link className="nav-auth-btn nav-auth-btn--login" to="/login" onClick={close}>
                Log in
              </Link>
              <Link className="nav-auth-btn nav-auth-btn--register" to="/signup" onClick={close}>
                Sign up
              </Link>
            </div>
          ) : (
            <div className="nav-user-menu" ref={menuRef}>
              <button
                type="button"
                className="nav-avatar"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={() => setMenuOpen((o) => !o)}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className="nav-avatar__img" />
                ) : (
                  <span className="nav-avatar__initial" aria-hidden>
                    {initial}
                  </span>
                )}
                <span className="nav-avatar__name">{displayName}</span>
              </button>
              {menuOpen ? (
                <div className="nav-dropdown" role="menu">
                  <Link to="/profile" role="menuitem" onClick={() => setMenuOpen(false)}>
                    Profile
                  </Link>
                  <Link to="/bookings" role="menuitem" onClick={() => setMenuOpen(false)}>
                    My Bookings
                  </Link>
                  <Link to="/my-matches" role="menuitem" onClick={() => setMenuOpen(false)}>
                    My Matches
                  </Link>
                  <Link to="/my-vouchers" role="menuitem" onClick={() => setMenuOpen(false)}>
                    My Vouchers
                  </Link>
                  <button type="button" role="menuitem" onClick={handleSignOut}>
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          )}

          <button
            type="button"
            className={`nav-toggle${open ? ' nav-toggle--open' : ''}`}
            aria-expanded={open}
            aria-controls={MOBILE_MENU_ID}
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="nav-toggle-line nav-toggle-line--top" aria-hidden />
            <span className="nav-toggle-line nav-toggle-line--mid" aria-hidden />
            <span className="nav-toggle-line nav-toggle-line--bot" aria-hidden />
          </button>
        </div>
      </header>

      <div className={`mobile-nav-backdrop${open ? ' mobile-nav-backdrop--open' : ''}`} aria-hidden={!open} onClick={close} />

      <div
        id={MOBILE_MENU_ID}
        className={`mobile-nav${open ? ' mobile-nav--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        aria-hidden={!open}
      >
        <nav className="mobile-nav-links" aria-label="Mobile site menu">
          {navLinks.map((l) => (
            <NavLink key={l.to} to={l.to} className={navClass} onClick={close}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        {variant === 'public' ? (
          <div className="mobile-nav-auth mobile-nav-auth--public">
            <Link className="nav-auth-btn nav-auth-btn--login" to="/login" onClick={close}>
              Log in
            </Link>
            <Link className="nav-auth-btn nav-auth-btn--register" to="/signup" onClick={close}>
              Sign up
            </Link>
          </div>
        ) : (
          <div className="mobile-nav-auth">
            <Link className="btn btn-ghost" to="/profile" onClick={close}>
              Profile
            </Link>
            <Link className="btn btn-ghost" to="/bookings" onClick={close}>
              My Bookings
            </Link>
            <button type="button" className="btn btn-primary" onClick={handleSignOut}>
              Logout
            </button>
          </div>
        )}
      </div>
    </>
  );
}
