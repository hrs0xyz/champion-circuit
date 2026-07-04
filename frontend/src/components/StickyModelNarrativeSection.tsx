import { HeroLocalGlbViewer } from './HeroLocalGlbViewer';

const STORY = [
  {
    model: '/models/virat_kohli_cricket_batting_animation_-_low_poly.glb',
    title: 'From broken turf to a maintained circuit',
    body: 'Structured leagues and competitive progression on top of hourly booking: the gap turf apps leave open.',
  },
  {
    model: '/models/game_controller.glb',
    title: 'Esports with a physical address',
    body: 'LAN-scale events and brand activations where online-only platforms cannot go. Community online, meetups offline.',
  },
  {
    model: '/models/brain.glb',
    title: 'Continuity you can build on',
    body: 'Performance tracking, calendar depth, and a youth membership mindset. Infrastructure as the moat, software as the lens.',
  },
] as const;

export function StickyModelNarrativeSection() {
  return (
    <section className="section narrative-steps-section" aria-label="How Champion Circuit works">
      <div className="section-inner">
        <div className="narrative-steps-grid">
          {STORY.map((item, idx) => (
            <article key={item.title} className="narrative-step">
              <div className="narrative-step__model">
                <HeroLocalGlbViewer url={item.model} fit="card" />
              </div>
              <div className="narrative-step__copy">
                <p className="sticky-step">Step {idx + 1}</p>
                <h3>{item.title}</h3>
                <p className="narrative-step__body">{item.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
