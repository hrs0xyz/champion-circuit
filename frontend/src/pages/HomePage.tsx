import { ArrowRight, ShieldCheck, Ticket, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';

const videos = ['/videos/football.mp4', '/videos/gaming1.mp4', '/videos/stadium.mp4'];

export function HomePage() {
  return (
    <main>
      <section className="hero">
        <div className="hero-media" aria-hidden="true">
          {videos.map((src, index) => (
            <video key={src} className={index === 0 ? 'active' : ''} src={src} autoPlay muted loop playsInline preload="metadata" />
          ))}
        </div>
        <div className="hero-scrim" />
        <div className="hero-content">
          <p className="eyebrow">Sports, esports, vouchers, events</p>
          <h1>Champion Circuit</h1>
          <p className="hero-copy">
            One place for players to discover events, buy vouchers, manage profiles, and enter the next wave of sports plus gaming experiences.
          </p>
          <div className="hero-actions">
            <Link className="primary-action" to="/signup">
              Start your profile <ArrowRight size={18} />
            </Link>
            <Link className="secondary-action" to="/login">
              Login
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="section-head">
          <p className="eyebrow">Phase one foundation</p>
          <h2>Built for a production path from day one.</h2>
        </div>
        <div className="feature-grid">
          <article>
            <Ticket />
            <h3>Voucher-ready</h3>
            <p>Profile and auth flows are in place so voucher browsing, checkout, and guest lookup can attach cleanly next.</p>
          </article>
          <article>
            <ShieldCheck />
            <h3>Partner traffic</h3>
            <p>The backend is structured for verified partner tokens and guest checkout when the external traffic rules are finalized.</p>
          </article>
          <article>
            <Trophy />
            <h3>Events and admin</h3>
            <p>The app starts as a modular monolith, ready for event listing, admin access, and event data capture without a rewrite.</p>
          </article>
        </div>
      </section>
    </main>
  );
}

