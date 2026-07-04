import { motion } from 'framer-motion';

export function ProfileTeamTeaser() {
  return (
    <motion.section
      id="profile-teams"
      className="section section-profile"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="section-inner">
        <div className="section-head">
          <h2>Profiles &amp; teams</h2>
          <p>
            Registration unlocks both turfs and brackets. Optional <strong>IGN</strong> and <strong>avatar</strong>{' '}
            fuel leaderboard presence; teams support invites for up to seven players with leader-only edits on the
            public side. Admins retain full override.
          </p>
        </div>
        <div className="profile-bento">
          <div className="profile-tile profile-tile--wide">
            <h3>Player identity</h3>
            <p className="muted">Name &amp; IGN editable anytime, tuned for casters and overlays.</p>
            <div className="profile-chips">
              <span className="chip chip--gold">Avatar optional</span>
              <span className="chip">City-aware turf</span>
              <span className="chip">Single sign-on</span>
            </div>
          </div>
          <div className="profile-tile">
            <h3>Team leader</h3>
            <p className="muted">Create, rename, remove players, or delete the roster. Leaders stay in control.</p>
          </div>
          <div className="profile-tile profile-tile--accent">
            <h3>7-seat invites</h3>
            <p className="muted">Email player slots with pending / accepted states, mirroring your admin tooling.</p>
            <div className="invite-rows" aria-hidden="true">
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <div key={n} className="invite-row">
                  <span>P{n}</span>
                  <span className="invite-pill">{n < 3 ? 'Accepted' : 'Pending'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
