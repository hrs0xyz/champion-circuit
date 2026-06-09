import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const heroContainer = {
  initial: {},
  animate: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
};

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  animate: { opacity: 1, y: 0 },
};

export function Hero({ scrollIntensity }: { scrollIntensity: number }) {
  const videos = ['/videos/football.mp4', '/videos/gaming1.mp4', '/videos/gaming2.mp4', '/videos/stadium.mp4'];
  const [activeVideo, setActiveVideo] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveVideo((i) => (i + 1) % videos.length);
    }, 5500);
    return () => window.clearInterval(id);
  }, [videos.length]);

  const switchVideo = (idx: number) => setActiveVideo(idx);

  return (
    <section className="hero" id="top">
      <div className="hero-bg-media" aria-hidden="true">
        {videos.map((src, idx) => (
          <video
            key={src}
            className={`hero-bg-video${idx === activeVideo ? ' is-active' : ''}`}
            src={src}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
          />
        ))}
        <div className="hero-bg-scrim" />
      </div>
      <div
        className="hero-glow"
        aria-hidden="true"
        style={{ opacity: 1 - scrollIntensity * 0.85 }}
      />
      <div className="hero-inner">
        <motion.div
          className="hero-copy"
          variants={heroContainer}
          initial="initial"
          animate="animate"
          style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}
        >
          <motion.div className="hero-kicker" variants={fadeUp} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}>
            <span className="hero-kicker-line" />
            <p className="eyebrow">Sports + Esports + Creators</p>
            <span className="hero-kicker-line" />
          </motion.div>
          <motion.h1 variants={fadeUp} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            Where Gaming Meets Sports
          </motion.h1>
          <motion.p className="hero-sub" variants={fadeUp} transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}>
            India&apos;s first integrated youth sports &amp; gaming ecosystem. Book a pitch, join a bracket, one
            membership, one community.
          </motion.p>
          <motion.div
            className="hero-actions"
            variants={fadeUp}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <Link className="btn btn-primary" to="/turf">
              Book a turf
            </Link>
            <Link className="btn btn-secondary" to="/esports">
              Join a tournament
            </Link>
          </motion.div>
        </motion.div>
      </div>
      <div className="hero-video-dots" aria-label="Hero media controls">
        {videos.map((v, idx) => (
          <button
            key={v}
            type="button"
            className={`vdot${idx === activeVideo ? ' active' : ''}`}
            onClick={() => switchVideo(idx)}
            aria-label={`Show hero video ${idx + 1}`}
          />
        ))}
      </div>
    </section>
  );
}
