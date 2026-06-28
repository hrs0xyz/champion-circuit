import { motion } from 'framer-motion';

const FORMATS = ['Knockout', 'Double elimination', 'Group stage', 'Group + KO'] as const;

export function EsportsSection() {
  return (
    <motion.section
      id="esports"
      className="section section-esports"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="esports-title"
    >
      <div className="section-inner">
        <div className="section-head">
          <h2 id="esports-title">Esports hub</h2>
          <p>
            Every surface the spec calls for: dropdown-ready IA, payments on registration when needed, Challonge-style
            bracket operations, and admin depth across formats.
          </p>
        </div>

        <div className="format-chip-row" aria-label="Tournament formats">
          {FORMATS.map((f) => (
            <span key={f} className="format-chip">
              {f}
            </span>
          ))}
        </div>

        <div className="esports-stages">
          <article id="esports-live" className="esports-stage">
            <h3>Live tournaments</h3>
            <p className="muted">
              Ongoing events by date, registration open states, gateway redirects for paid sign-ups, and instant entry
              into the bracket narrative.
            </p>
          </article>
          <article id="esports-upcoming" className="esports-stage">
            <h3>Upcoming</h3>
            <p className="muted">Announced but locked: surface name, date, format, and game before reg drops.</p>
          </article>
          <article id="esports-completed" className="esports-stage">
            <h3>Completed</h3>
            <p className="muted">Winners, standings, and highlight hooks for your broadcast or recap pages.</p>
          </article>
          <article id="esports-exclusive" className="esports-stage esports-stage--exclusive">
            <span className="stage-tag">Brand</span>
            <h3>Exclusive</h3>
            <p className="muted">Partner-flagged drops marked in admin, with premium lanes for sponsors &amp; collabs.</p>
          </article>
        </div>

        <div className="split-panels split-panels--spaced">
          <div>
            <h3>Player experience</h3>
            <ul className="checklist">
              <li>Home storytelling with esports-grade art direction</li>
              <li>Live tournaments with registration and payments when needed</li>
              <li>Upcoming cards: date, format, and game at a glance</li>
              <li>Finished events with winners, standings, and highlights</li>
              <li>Brand-backed “Exclusive” tournaments</li>
            </ul>
            <p className="muted small">
              Admin panel covers editors, tournament CRUD, filters, SEO fields, format-specific result editors, and
              manual overrides when disputes hit.
            </p>
          </div>
          <div id="leaderboard" className="leaderboard-teal leaderboard-teal--glow">
            <h3>Leaderboard points</h3>
            <div className="table-scroll">
              <table className="points-table">
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Points</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>Tournament registration</td>
                    <td>1</td>
                  </tr>
                  <tr>
                    <td>Qualifying a round</td>
                    <td>1</td>
                  </tr>
                  <tr>
                    <td>Winning a tournament</td>
                    <td>3</td>
                  </tr>
                  <tr>
                    <td>2nd place</td>
                    <td>2</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="muted">Totals roll up across every tournament you play on-platform.</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
