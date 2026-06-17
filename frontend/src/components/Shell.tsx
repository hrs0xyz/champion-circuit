import { LogOut, UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="app">
      <header className="site-header">
        <Link className="brand" to="/" aria-label="Champion Circuit home">
          <span className="brand-mark">CC</span>
          <span>Champion Circuit</span>
        </Link>
        <nav className="nav">
          <NavLink to="/">Home</NavLink>
          {user ? <NavLink to="/profile">Profile</NavLink> : <NavLink to="/login">Login</NavLink>}
          {user ? (
            <button className="icon-button" type="button" onClick={logout} aria-label="Log out" title="Log out">
              <LogOut size={18} />
            </button>
          ) : (
            <Link className="icon-button" to="/signup" aria-label="Sign up" title="Sign up">
              <UserRound size={18} />
            </Link>
          )}
        </nav>
      </header>
      {children}
    </div>
  );
}

