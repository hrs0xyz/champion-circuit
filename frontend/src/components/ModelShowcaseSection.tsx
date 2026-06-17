import { lazy, Suspense } from 'react';
import { motion } from 'framer-motion';
import { ErrorBoundary } from './ErrorBoundary';

const HeroRotatingShowcase = lazy(() =>
  import('./HeroRotatingShowcase').then((m) => ({ default: m.HeroRotatingShowcase })),
);

export function ModelShowcaseSection() {
  return (
    <motion.section
      className="section section-models"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="section-inner">
        <div className="section-head">
          <h2>3D showcase</h2>
          <p>Explore Champion Circuit models and assets before diving into product features.</p>
        </div>
        <div className="hero-canvas-natural">
          <ErrorBoundary fallback={<div className="hero-unified-3d hero-unified-3d--loading" aria-hidden="true" />}>
            <Suspense fallback={<div className="hero-unified-3d hero-unified-3d--loading" aria-hidden="true" />}>
              <HeroRotatingShowcase scrollIntensity={0} />
            </Suspense>
          </ErrorBoundary>
        </div>
      </div>
    </motion.section>
  );
}

