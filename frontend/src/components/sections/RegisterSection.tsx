import { motion } from 'framer-motion';

export function RegisterSection() {
  return (
    <motion.section
      id="register"
      className="section section-register"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="section-inner narrow">
        <div className="section-head">
          <h2>One registration, two worlds</h2>
          <p>The same profile powers turf nights and bracket nights, with room for your competitive identity.</p>
        </div>
        <div className="register-grid">
          <div>
            <h3>Required</h3>
            <ul className="pill-list">
              <li>Name</li>
              <li>Email</li>
              <li>Contact number</li>
              <li>City</li>
              <li>Age</li>
            </ul>
          </div>
          <div>
            <h3>Optional flair</h3>
            <ul className="pill-list">
              <li>In-game name</li>
              <li>Profile picture</li>
            </ul>
            <p className="muted small">Perfect for leaderboards, invites, and team rosters.</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
