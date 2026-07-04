import { usePlatform } from '../../context/PlatformContext';

export function AdminContentPage() {
  const { siteContent, setSiteContent } = usePlatform();

  return (
    <div className="admin-page">
      <h1>Content</h1>
      <p className="muted">Editable copy surfaced on the public esports and marketing surfaces.</p>
      <div className="platform-form">
        <label className="admin-label" htmlFor="esports-intro">
          Esports intro
        </label>
        <textarea
          id="esports-intro"
          rows={3}
          value={siteContent.esportsIntro}
          onChange={(e) => setSiteContent({ ...siteContent, esportsIntro: e.target.value })}
        />
        <label className="admin-label" htmlFor="home-desc">
          Home / hub description
        </label>
        <textarea
          id="home-desc"
          rows={3}
          value={siteContent.homeDescription}
          onChange={(e) => setSiteContent({ ...siteContent, homeDescription: e.target.value })}
        />
        <label className="admin-label" htmlFor="home-bg">
          Esports background image URL
        </label>
        <input
          id="home-bg"
          value={siteContent.homeBackground}
          onChange={(e) => setSiteContent({ ...siteContent, homeBackground: e.target.value })}
        />
      </div>
    </div>
  );
}
