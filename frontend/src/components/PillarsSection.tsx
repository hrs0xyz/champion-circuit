import { motion } from 'framer-motion';

export function PillarsSection() {
  return (
    <motion.section
      className="section section-pillars"
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="section-inner">
        <div className="section-head section-head--center">
          <h2>Two engines. One circuit.</h2>
          <p>
            Turf booking and esports each run on <strong>dedicated backends</strong>: clean separation, faster
            iteration, and room to scale AI on the pitch side without touching bracket logic.
          </p>
        </div>
        <div className="pillar-grid">
          <article className="pillar-card pillar-card--turf">
            <span className="pillar-badge">Turf · Future AI</span>
            <h3>Bookings &amp; schedules</h3>
            <p>
              Location-based turf listings, hourly slots, blurred sold-out windows, checkout, and admin slot
              control, plus a roadmap for smart scheduling and performance insight.
            </p>
            <ul className="pillar-list">
              <li>Profiles &amp; city-aware discovery</li>
              <li>Editable copy &amp; timings from admin</li>
              <li>Payments route after slot lock</li>
            </ul>
            <a className="pillar-link" href="#turf">
              Explore turf booking
            </a>
          </article>
          <article className="pillar-card pillar-card--esports">
            <span className="pillar-badge pillar-badge--hot">Esports hub</span>
            <h3>Tournaments &amp; glory</h3>
            <p>
              Live, upcoming, completed, and exclusive events with registration, payments when required, and a
              unified points ladder inspired by Challonge-grade bracket ops.
            </p>
            <ul className="pillar-list">
              <li>Home storytelling &amp; esports art direction</li>
              <li>Formats: KO, double elim, groups, hybrid</li>
              <li>Leaderboard manager + manual corrections</li>
            </ul>
            <a className="pillar-link" href="#esports">
              See the esports surface
            </a>
          </article>
        </div>
      </div>
    </motion.section>
  );
}
