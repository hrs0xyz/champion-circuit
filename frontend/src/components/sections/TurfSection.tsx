import { motion } from 'framer-motion';
import { TurfSlotDemo } from '../TurfSlotDemo';

export function TurfSection() {
  return (
    <motion.section
      id="turf"
      className="section section-turf"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="section-inner">
        <div className="section-head">
          <h2>Turf booking</h2>
          <p>
            Front office clarity: descriptions, geo listings, hourly grids, slot locking, and payment handoffs, with admin
            truth on copy, timings, and overrides.
          </p>
        </div>
        <div className="cards">
          <article className="card">
            <h3>Location-aware listings</h3>
            <p>Surface turfs near the player’s city so every session starts with the right venue.</p>
          </article>
          <article className="card">
            <h3>Hourly clarity</h3>
            <p>Slots like 6-7 PM and 7-8 PM, with booked windows blurred so doubles never happen.</p>
          </article>
          <article className="card">
            <h3>Payments that stick</h3>
            <p>Pick an open slot, pay, and lock it in. Admins can tune copy, timings, and overrides.</p>
          </article>
          <article className="card card-wide">
            <h3>AI-ready roadmap</h3>
            <p>Smart scheduling, performance cues, and tailored recommendations ship after the booking core is live.</p>
          </article>
        </div>
        <TurfSlotDemo />
      </div>
    </motion.section>
  );
}
