import { motion } from 'framer-motion';

const PARTNERS = ['IIM Calcutta', 'IIT (BHU) Varanasi'] as const;

function PartnerMarqueeTrack({ ariaHidden = false }: { ariaHidden?: boolean }) {
  return (
    <div className="partner-marquee__track" aria-hidden={ariaHidden || undefined}>
      {[...PARTNERS, ...PARTNERS, ...PARTNERS].map((name, i) => (
        <span key={`${name}-${i}`} className="partner-marquee__item">
          {name}
          <span className="partner-marquee__sep" aria-hidden>
            ·
          </span>
        </span>
      ))}
    </div>
  );
}

export function ClientsSection() {
  return (
    <motion.section
      id="clients"
      className="lp-section lp-clients"
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="clients-title"
    >
      <div className="lp-section__inner">
        <header className="lp-section__head">
          <span className="lp-kicker">// Backed by</span>
          <h2 id="clients-title" className="lp-section__title">
            Brands &amp; <span className="lp-grad">partners</span>
          </h2>
          <p className="lp-section__lead">
            Backed by leading institutions shaping India&apos;s next generation of sport and gaming talent.
          </p>
        </header>
        <div className="partner-marquee" role="region" aria-label="University partners">
          <div className="partner-marquee__viewport">
            <div className="partner-marquee__inner">
              <PartnerMarqueeTrack />
              <PartnerMarqueeTrack ariaHidden />
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
