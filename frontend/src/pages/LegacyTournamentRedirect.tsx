import { useEffect, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { PageContainer } from '../components/ui/PageContainer';
import { ccApi } from '../lib/ccApi';

/**
 * Keeps old /esports/tournament/:id links (shared in WhatsApp groups,
 * notification history) alive by resolving the id to the canonical
 * /tournaments/:slug page.
 */
export function LegacyTournamentRedirect() {
  const { id } = useParams<{ id: string }>();
  const [slug, setSlug] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id || Number.isNaN(Number(id))) { setFailed(true); return; }
    ccApi.tournament(Number(id))
      .then((t) => setSlug(t.slug))
      .catch(() => setFailed(true));
  }, [id]);

  if (failed) return <Navigate to="/tournaments" replace />;
  if (slug) return <Navigate to={`/tournaments/${slug}`} replace />;
  return (
    <section className="section section-esports">
      <PageContainer narrow>
        <div className="tournament-card-skeleton" />
      </PageContainer>
    </section>
  );
}
