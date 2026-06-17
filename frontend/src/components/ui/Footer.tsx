import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-inner footer-inner--grid">
        <div className="footer-brand">
          <p className="footer-tag">Where Gaming Meets Sports</p>
          <p className="muted small">India&apos;s first integrated youth sports &amp; gaming ecosystem.</p>
        </div>
        <nav className="footer-nav" aria-label="Footer">
          <Link to="/turf">Turf</Link>
          <Link to="/esports">Esports</Link>
          <Link to="/leaderboard">Leaderboard</Link>
          <Link to="/about">About</Link>
          <a href="mailto:contact@championcircuit.com">Contact</a>
        </nav>
        <div className="footer-contact muted small">
          <a href="mailto:contact@championcircuit.com">contact@championcircuit.com</a>
        </div>
        <span className="footer-copy">
          &copy; {new Date().getFullYear()} Champion Circuit Private Limited. All rights reserved.
        </span>
      </div>
    </footer>
  );
}
