export function LandingInfoSection() {
  return (
    <section id="landing-features" className="section section-landing-info">
      <div className="section-inner">
        <div className="section-head section-head--center landing-info-head">
          <h2>One hub. One community.</h2>
          <p>Turf, esports, wellness, and performance tracking in one membership.</p>
        </div>
        <div className="cards landing-info-grid">
          <article className="card">
            <h3>Turf sports</h3>
            <p>Book pitches and play in maintained facilities with local leagues.</p>
          </article>
          <article className="card">
            <h3>Esports arena</h3>
            <p>Online and offline tournaments with a real venue for your community.</p>
          </article>
          <article className="card">
            <h3>Health &amp; wellness</h3>
            <p>Recovery, pool, and leisure between match days.</p>
          </article>
          <article className="card">
            <h3>AI &amp; performance</h3>
            <p>Profiles and insights that grow with every season.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
