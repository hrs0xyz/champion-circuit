import { useEffect, useState } from 'react';
import { Hero } from '../components/Hero';
import { LandingInfoSection } from '../components/LandingInfoSection';
import { ClientsSection } from '../components/sections/ClientsSection';
import { LandingCtaSection } from '../components/sections/LandingCtaSection';
// import { StickyModelNarrativeSection } from '../components/StickyModelNarrativeSection';
// import { EarlyAccessSection } from '../components/sections/EarlyAccessSection';
// import { BrandShowcaseSection } from '../components/BrandShowcaseSection';

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
      <LandingCtaSection />
      {/* Step 1/2/3 "How it works" section — hidden for now, restore by uncommenting */}
      {/* <StickyModelNarrativeSection /> */}
      {/* "Get your voucher" early-access section — hidden for now, restore by uncommenting */}
      {/* <EarlyAccessSection /> */}
      {/* Champion Circuit banner image below Brands & partners — hidden for now, restore by uncommenting */}
      {/* <BrandShowcaseSection /> */}
    </>
  );
}
