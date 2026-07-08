import { PageContainer } from '../components/ui/PageContainer';
import { FoundersSection } from '../components/sections/FoundersSection';

export function AboutPage() {
  return (
    <>
      <section className="section">
        <PageContainer narrow>
          <div className="section-head">
            <h1>About Champion Circuit</h1>
            <p>
              Champion Circuit is India&apos;s first integrated youth sports and gaming ecosystem: one hub where
              Players book maintained turfs, compete in offline and online esports, recover in wellness facilities, and
              build toward AI-backed performance tracking.
            </p>
          </div>
          <p className="muted about-lead">
            We bridge physical sport and digital gaming for brands, colleges, and communities with structured leagues,
            permanent esports infrastructure, and a single membership mindset.
          </p>
          <div className="about-block">
            <h2>Research &amp; validation</h2>
            <p>
              Field research with IIM Calcutta and IIT (BHU) Varanasi, I-DAPT Hub incubation, and Top 25 Bengal Business
              Accelerator 2025 (IIM Calcutta). Through its pre-facility phase (Oct 2025-Mar 2026), Champion Circuit served
              as online-phase execution partner for the Asian Games India Qualifier 2026.
            </p>
          </div>
        </PageContainer>
      </section>
      <FoundersSection />
    </>
  );
}
