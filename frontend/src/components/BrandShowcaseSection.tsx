import { motion } from 'framer-motion';

export function BrandShowcaseSection() {
  return (
    <motion.section
      className="section-brand-showcase"
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      aria-label="Champion Circuit brand"
    >
      <img src="/branding/cc-banner.png" alt="Champion Circuit banner" className="brand-footer-banner" />
    </motion.section>
  );
}

