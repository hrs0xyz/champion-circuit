import { motion } from 'framer-motion';

const GAMES = [
  {
    title: 'Champion Tower',
    src: 'https://www.gamesbyzeon.com/share-mnis4xdf-z7n1hd',
  },
  {
    title: 'Cognitive Sorter',
    src: 'https://www.gamesbyzeon.com/share-mnis643g-xneao1',
  },
  {
    title: 'Airplane Simulator',
    src: 'https://www.gamesbyzeon.com/share-mnis6fqd-9k6zk1',
  },
] as const;

const POPUP_NAME = 'champion-circuit-ai-game';

/**
 * These games load from an external host; embedding in an iframe often fails (X-Frame-Options / CSP).
 * A real browser popup or new tab loads the game origin correctly.
 */
function openGamePopup(url: string) {
  const margin = 32;
  const sw = window.screen.availWidth;
  const sh = window.screen.availHeight;
  const w = Math.min(1120, Math.max(320, sw - margin));
  const h = Math.min(800, Math.max(480, sh - margin));
  const left = Math.max(0, Math.round((sw - w) / 2));
  const top = Math.max(0, Math.round((sh - h) / 2));

  const features = [
    'popup=yes',
    `width=${w}`,
    `height=${h}`,
    `left=${left}`,
    `top=${top}`,
    'scrollbars=yes',
    'resizable=yes',
  ].join(',');

  const win = window.open(url, POPUP_NAME, features);
  if (win) {
    try {
      win.opener = null;
    } catch {
      /* ignore */
    }
    win.focus();
  } else {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

export function AiGamesSection() {
  return (
    <motion.section
      id="ai-games"
      className="section section-ai-games"
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="ai-games-title"
    >
      <div className="section-inner">
        <div className="section-head">
          <h2 id="ai-games-title">AI Games</h2>
          <p>
            Quick minigames from the circuit. Each one opens in a new window so it loads reliably.
          </p>
        </div>
        <div className="ai-games-grid">
          {GAMES.map((g) => (
            <button
              key={g.src}
              type="button"
              className="ai-game-card ai-game-card--btn"
              onClick={() => openGamePopup(g.src)}
            >
              <span className="ai-game-label">{g.title}</span>
              <span className="ai-game-play-icon" aria-hidden>
                ▶
              </span>
            </button>
          ))}
        </div>
        <p className="ai-games-hint small muted">
          If your browser blocks pop-ups, the game opens in a new tab instead.
        </p>
      </div>
    </motion.section>
  );
}
