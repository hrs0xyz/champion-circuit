import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usePlatform } from '../context/PlatformContext';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import { CityBar } from '../components/ui/CityBar';
import { browseTabLabel, filterTournamentsByTab, type TournamentBrowseTab } from '../lib/platformUtils';
import { PageContainer } from '../components/ui/PageContainer';
import { TournamentCard } from '../components/shared/TournamentCard';
import { EmptyState } from '../components/ui/EmptyState';

const TABS: TournamentBrowseTab[] = ['live', 'upcoming', 'completed', 'exclusive'];

export function EsportsBrowsePage() {
  const [tab, setTab] = useState<TournamentBrowseTab>('live');
  const [msg, setMsg] = useState<string | null>(null);
  const { tournaments, siteContent, registerTournament } = usePlatform();
  const { user } = useAuth();
  const { matchesCity } = useCity();
  const navigate = useNavigate();

  // Tournaments don't have a city field in seed yet — filter is ready for when they do
  const byCity = tournaments.filter((t) =>
    !('city' in t) || matchesCity((t as { city?: string }).city ?? '')
  );
  const list = filterTournamentsByTab(byCity, tab);

  const onRegister = (id: string) => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/esports/tournament/${id}`)}`);
      return;
    }
    const err = registerTournament(id);
    setMsg(err);
    if (!err) setMsg('Registration complete.');
  };

  return (
    <section className="section section-esports">
      <PageContainer>
        <CityBar />

        <div className="section-head" style={{ marginTop: 24 }}>
          <h1>Esports hub</h1>
          <p>{siteContent.esportsIntro}</p>
        </div>

        <div className="tab-row" role="tablist" aria-label="Tournament status">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              className={`tab-btn${tab === t ? ' is-active' : ''}${t === 'exclusive' ? ' tab-btn--exclusive' : ''}`}
              onClick={() => { setTab(t); setMsg(null); }}
            >
              {browseTabLabel(t)}
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <EmptyState title="No tournaments here" description="Check another tab or come back soon." />
        ) : (
          <div className="cards tournament-grid">
            {list.map((t) => (
              <TournamentCard
                key={t.id}
                tournament={t}
                showRegister={!!user}
                onRegister={() => onRegister(t.id)}
                registerMessage={msg}
              />
            ))}
          </div>
        )}

        {!user ? (
          <p className="auth-inline muted small">
            <Link className="auth-inline__link" to="/login">Sign in</Link>
            <span className="auth-inline__text"> to register for live events.</span>
          </p>
        ) : null}
      </PageContainer>
    </section>
  );
}
