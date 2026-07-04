import { motion } from 'framer-motion';

const PILLARS = [
  {
    num: '.01',
    title: 'Turf Sports',
    body: 'Book maintained pitches, join local leagues, and let venues run tournaments end-to-end.',
  },
  {
    num: '.02',
    title: 'Esports Arena',
    body: 'Online and offline brackets across BGMI, Valorant, Free Fire and more — with a real venue.',
  },
  {
    num: '.03',
    title: 'Health & Wellness',
    body: 'Recovery, pool, and leisure between match days. Built around how players actually live.',
  },
  {
    num: '.04',
    title: 'AI & Performance',
    body: 'Wearables and player profiles that turn every session into data, insight, and progress.',
  },
] as const;

const ease = [0.22, 1, 0.36, 1] as const;

export function LandingInfoSection() {
  return (
    <section id="landing-features" className="lp-section lp-pillars">
      <div className="lp-section__inner">
        <header className="lp-section__head">
          <span className="lp-kicker">// The Ecosystem</span>
          <h2 className="lp-section__title">
            One hub. <span className="lp-grad">One community.</span>
          </h2>
          <p className="lp-section__lead">
            Turf, esports, wellness, and performance tracking — unified into a single membership.
          </p>
        </header>

        <div className="lp-pillars__grid">
          {PILLARS.map((p, i) => (
            <motion.article
              key={p.num}
              className="lp-pillar"
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease, delay: i * 0.06 }}
            >
              <span className="lp-pillar__num" aria-hidden="true">
                {p.num}
              </span>
              <h3 className="lp-pillar__title">{p.title}</h3>
              <p className="lp-pillar__body">{p.body}</p>
              <span className="lp-pillar__edge" aria-hidden="true" />
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
