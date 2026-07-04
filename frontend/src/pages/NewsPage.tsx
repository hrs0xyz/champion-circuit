import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ccApi, type NewsArticle } from '../lib/ccApi';

const CATEGORIES = ['All', 'esports', 'sports', 'general', 'announcement'];

function ArticleCard({ a }: { a: NewsArticle }) {
  return (
    <Link to={`/news/${a.id}`} className="news-card">
      {a.cover_url ? (
        <div className="news-card__img-wrap">
          <img src={a.cover_url} alt={a.title} className="news-card__img" />
        </div>
      ) : (
        <div className="news-card__img-placeholder">📰</div>
      )}
      <div className="news-card__body">
        <span className={`news-card__cat news-card__cat--${a.category}`}>{a.category}</span>
        <h3 className="news-card__title">{a.title}</h3>
        {a.summary ? <p className="news-card__summary">{a.summary}</p> : null}
        <p className="news-card__date muted small">
          {a.published_at ? new Date(a.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''}
        </p>
      </div>
    </Link>
  );
}

export function NewsPage() {
  const [cat, setCat] = useState('All');
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    ccApi.news(cat === 'All' ? '' : cat)
      .then(setArticles)
      .catch(() => setArticles([]))
      .finally(() => setLoading(false));
  }, [cat]);

  return (
    <section className="section section-news">
      <div className="section-inner">
        <div className="section-head">
          <h1>News</h1>
          <p>Esports, sports, and Champion Circuit updates.</p>
        </div>

        {/* Category chips */}
        <div className="news-cats">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className={`city-chip${cat === c ? ' city-chip--active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="news-grid-loading">
            {[1, 2, 3, 4].map((i) => <div key={i} className="news-card-skeleton" />)}
          </div>
        ) : articles.length === 0 ? (
          <div className="lb-empty">
            <p className="lb-empty__icon">📰</p>
            <p className="lb-empty__title">No articles yet</p>
            <p className="lb-empty__sub">Check back soon for updates.</p>
          </div>
        ) : (
          <div className="news-grid">
            {articles.map((a) => <ArticleCard key={a.id} a={a} />)}
          </div>
        )}
      </div>
    </section>
  );
}

export function NewsArticlePage() {
  const { id } = useParams<{ id: string }>();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    ccApi.newsArticle(Number(id))
      .then(setArticle)
      .catch(() => setArticle(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <section className="section"><div className="section-inner"><div className="news-article-skeleton" /></div></section>;
  if (!article) return (
    <section className="section"><div className="section-inner">
      <p className="auth-error">Article not found.</p>
      <Link to="/news" className="btn btn-secondary btn-sm" style={{ marginTop: 16 }}>← All news</Link>
    </div></section>
  );

  return (
    <section className="section section-news-article">
      <div className="section-inner narrow">
        <Link to="/news" className="venue-detail__back">← All news</Link>

        {article.cover_url ? (
          <img src={article.cover_url} alt={article.title} className="news-article__cover" />
        ) : null}

        <span className={`news-card__cat news-card__cat--${article.category}`} style={{ marginTop: 20, display: 'inline-block' }}>
          {article.category}
        </span>

        <h1 className="news-article__title">{article.title}</h1>

        {article.published_at ? (
          <p className="news-article__date muted small">
            {new Date(article.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}{article.view_count} views
          </p>
        ) : null}

        {article.summary ? (
          <p className="news-article__summary">{article.summary}</p>
        ) : null}

        <div
          className="news-article__body"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: article.body.replace(/\n/g, '<br/>') }}
        />

        {article.tags ? (
          <div className="news-article__tags">
            {article.tags.split(',').filter(Boolean).map((tag) => (
              <span key={tag} className="profile-tag">{tag.trim()}</span>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
