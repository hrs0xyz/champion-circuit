import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { HERO_GLTF_MODELS } from '../data/heroModels';

const LazyGlbViewer = ({ url }: { url: string }) => {
  const Comp = useRef<typeof import('./HeroLocalGlbViewer').HeroLocalGlbViewer | null>(null);
  const [, bump] = useState(0);
  useEffect(() => {
    import('./HeroLocalGlbViewer').then((m) => {
      Comp.current = m.HeroLocalGlbViewer;
      bump((n) => n + 1);
    });
  }, []);
  if (!Comp.current) return <div className="hero-local-glb-fallback" aria-hidden="true" />;
  const C = Comp.current;
  return <C url={url} />;
};

const SLIDE_MS = 7000;
const N = HERO_GLTF_MODELS.length;

export function HeroRotatingShowcase({ scrollIntensity: _si }: { scrollIntensity: number }) {
  const [previewIdx, setPreviewIdx] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogIdx, setDialogIdx] = useState(0);
  const reducedMotion = useReducedMotion();

  const goNextPreview = useCallback(() => setPreviewIdx((i) => (i + 1) % N), []);

  useEffect(() => {
    if (reducedMotion || dialogOpen) return undefined;
    const id = window.setInterval(goNextPreview, SLIDE_MS);
    return () => clearInterval(id);
  }, [reducedMotion, dialogOpen, goNextPreview]);

  const openDialog = () => {
    setDialogIdx(previewIdx);
    setDialogOpen(true);
  };

  const closeDialog = () => setDialogOpen(false);

  const goPrev = useCallback(() => setDialogIdx((i) => (i - 1 + N) % N), []);
  const goNext = useCallback(() => setDialogIdx((i) => (i + 1) % N), []);

  useEffect(() => {
    if (!dialogOpen) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'Escape') closeDialog();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dialogOpen, goPrev, goNext]);

  useEffect(() => {
    document.body.style.overflow = dialogOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [dialogOpen]);

  return (
    <>
      <button
        type="button"
        className="hero-unified-3d"
        onClick={openDialog}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        aria-label="Open 3D model explorer"
      >
        <Suspense fallback={<div className="hero-local-glb-fallback" aria-hidden="true" />}>
          <LazyGlbViewer url={HERO_GLTF_MODELS[previewIdx]} />
        </Suspense>
        <div className={`hero-explore-overlay${hovered ? ' is-visible' : ''}`} aria-hidden="true">
          <span className="hero-explore-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </span>
          <span className="hero-explore-label">Click to explore</span>
        </div>
      </button>

      {dialogOpen && (
        <div className="model-dialog-backdrop" onClick={closeDialog} role="presentation">
          <div
            className="model-dialog"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="3D Model explorer"
          >
            <div className="model-dialog-canvas">
              <Suspense fallback={<div className="hero-local-glb-fallback" aria-hidden="true" />}>
                <LazyGlbViewer url={HERO_GLTF_MODELS[dialogIdx]} />
              </Suspense>
            </div>

            <div className="model-dialog-bar">
              <button type="button" className="model-dialog-btn" onClick={goPrev} aria-label="Previous model">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>

              <span className="model-dialog-counter">{dialogIdx + 1} / {N}</span>

              <button type="button" className="model-dialog-btn" onClick={goNext} aria-label="Next model">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 6 15 12 9 18"/></svg>
              </button>
            </div>

            <button type="button" className="model-dialog-close" onClick={closeDialog} aria-label="Close">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
