import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const ease = [0.22, 1, 0.36, 1] as const;

export function LandingCtaSection() {
  return (
    <section className="lp-section lp-cta">
      <motion.div
        className="lp-cta__panel"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-80px' }}
        transition={{ duration: 0.55, ease }}
      >
        <span className="lp-cta__glow" aria-hidden="true" />
        <span className="lp-kicker">// Join the circuit</span>
        <h2 className="lp-cta__title">
          The future of play is <span className="lp-grad">one platform.</span>
        </h2>
        <p className="lp-cta__lead">
          Book turf, compete in esports, and build a performance profile that grows every season.
        </p>
        <div className="lp-cta__actions">
          <Link className="lp-btn lp-btn--primary" to="/signup">
            Create your account
            <span className="lp-btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
          <Link className="lp-btn lp-btn--ghost" to="/turf">
            Explore turfs
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
