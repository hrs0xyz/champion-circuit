import { useEffect, useState } from 'react';
import { Hero } from '../components/Hero';
import { LandingInfoSection } from '../components/LandingInfoSection';
import { ClientsSection } from '../components/sections/ClientsSection';
import { StickyModelNarrativeSection } from '../components/StickyModelNarrativeSection';
import { FoundersSection } from '../components/sections/FoundersSection';
import { EarlyAccessSection } from '../components/sections/EarlyAccessSection';
import { BrandShowcaseSection } from '../components/BrandShowcaseSection';

function useScrollProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? Math.min(window.scrollY / max, 1) : 0);
    };
    window.addEventListener('scroll', update, { passive: true });
    update();
    return () => window.removeEventListener('scroll', update);
  }, []);
  return progress;
}

export function LandingPage() {
  const scrollProgress = useScrollProgress();
  return (
    <>
      <Hero scrollIntensity={scrollProgress} />
      <LandingInfoSection />
      <ClientsSection />
      <StickyModelNarrativeSection />
      <FoundersSection />
      <EarlyAccessSection />
      <BrandShowcaseSection />
    </>
  );
}
