import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const container = {
  initial: {},
  animate: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
};

const ease = [0.22, 1, 0.36, 1] as const;

const TICKER = ['Turf Booking', 'Esports Arena', 'Performance Analysis'] as const;

export function Hero({ scrollIntensity }: { scrollIntensity: number }) {
  return (
    <section className="lp-hero" id="top">
      {/* drifting energy orb behind the headline; fades as you scroll */}
      <div className="lp-hero__orb" aria-hidden="true" style={{ opacity: 1 - scrollIntensity * 0.9 }} />

      {/* HUD corner brackets */}
      <span className="lp-hud lp-hud--tl" aria-hidden="true" />
      <span className="lp-hud lp-hud--tr" aria-hidden="true" />
      <span className="lp-hud lp-hud--bl" aria-hidden="true" />
      <span className="lp-hud lp-hud--br" aria-hidden="true" />

      <motion.div className="lp-hero__inner" variants={container} initial="initial" animate="animate">
        <motion.p className="lp-eyebrow" variants={fadeUp} transition={{ duration: 0.5, ease }}>
          <span className="lp-eyebrow__dot" aria-hidden="true" />
          Sports&nbsp;&times;&nbsp;Esports&nbsp;&times;&nbsp;Performance&nbsp;Analysis
        </motion.p>

        <motion.h1 className="lp-hero__title" variants={fadeUp} transition={{ duration: 0.65, ease }}>
          Where Gaming
          <br />
          Meets <span className="lp-grad">Sports</span>
        </motion.h1>

        <motion.p className="lp-hero__sub" variants={fadeUp} transition={{ duration: 0.6, ease }}>
          India&apos;s first integrated youth sports &amp; gaming ecosystem. Book a pitch, join a bracket, track your
          game &mdash; one membership, one community.
        </motion.p>

        <motion.div className="lp-hero__cta" variants={fadeUp} transition={{ duration: 0.55, ease }}>
          <Link className="lp-btn lp-btn--primary" to="/turf">
            Book a turf
            <span className="lp-btn__arrow" aria-hidden="true">
              &rarr;
            </span>
          </Link>
          <Link className="lp-btn lp-btn--ghost" to="/esports">
            Join a tournament
          </Link>
        </motion.div>

        <motion.ul className="lp-hero__ticker" variants={fadeUp} transition={{ duration: 0.55, ease }} aria-label="What's inside">
          {TICKER.map((item) => (
            <li key={item} className="lp-chip">
              <span className="lp-chip__dot" aria-hidden="true" />
              {item}
            </li>
          ))}
        </motion.ul>
      </motion.div>
    </section>
  );
}
