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
      className="section section-clients"
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="clients-title"
    >
      <div className="section-inner">
        <div className="section-head section-head--center">
          <h2 id="clients-title">Brands &amp; partners</h2>
          <p>Backed by leading institutions shaping India&apos;s next generation of sport and gaming talent.</p>
        </div>
        <div className="partner-marquee" role="region" aria-label="University partners">
          <div className="partner-marquee__fade partner-marquee__fade--left" aria-hidden />
          <div className="partner-marquee__viewport">
            <div className="partner-marquee__inner">
              <PartnerMarqueeTrack />
              <PartnerMarqueeTrack ariaHidden />
            </div>
          </div>
          <div className="partner-marquee__fade partner-marquee__fade--right" aria-hidden />
        </div>
      </div>
    </motion.section>
  );
}
