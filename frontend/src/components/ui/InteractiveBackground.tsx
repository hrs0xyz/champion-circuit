import { useEffect, useRef } from 'react';

/**
 * Site-wide animated backdrop: a free-flowing particle field (Nodwin-style)
 * that links nearby particles with faint lines and reacts to the cursor
 * (21TSI-style) — particles near the pointer connect to it and are gently
 * pushed away.
 *
 * Rendered on a single fixed full-viewport <canvas> (pointer-events: none).
 * Tuned for production: device-pixel-ratio capped at 2, particle count scaled
 * to viewport area, the loop pauses when the tab is hidden, and a static frame
 * is drawn (no animation) when the user prefers reduced motion.
 */

/**
 * Each particle keeps a permanent slow drift (dvx/dvy) so it never stops, plus
 * a transient cursor impulse (ix/iy) that decays — so the mouse push feels
 * springy but the field keeps flowing forever.
 */
type Particle = { x: number; y: number; dvx: number; dvy: number; ix: number; iy: number; r: number };

const ACCENT = '10, 191, 188';
const ACCENT_BRIGHT = '29, 233, 230';
const LINK_DIST = 130; // px — link two particles when closer than this
const MOUSE_DIST = 175; // px — cursor interaction radius
const DRIFT_MIN = 0.05; // px/frame — slowest base drift speed
const DRIFT_MAX = 0.16; // px/frame — fastest base drift speed

export function InteractiveBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let raf = 0;
    const pointer = { x: -9999, y: -9999, active: false };

    const makeParticle = (): Particle => {
      const angle = Math.random() * Math.PI * 2;
      const speed = DRIFT_MIN + Math.random() * (DRIFT_MAX - DRIFT_MIN);
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        dvx: Math.cos(angle) * speed,
        dvy: Math.sin(angle) * speed,
        ix: 0,
        iy: 0,
        r: Math.random() * 1.6 + 0.6,
      };
    };

    let targetCount = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // density scaled to area, capped so big screens never get sluggish
      targetCount = Math.max(28, Math.min(130, Math.floor((width * height) / 15000)));
      particles = Array.from({ length: targetCount }, makeParticle);
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // keep the field topped up (handles resize-up or any lost particle)
      while (particles.length < targetCount) particles.push(makeParticle());

      // 1) advance positions: permanent slow drift + decaying cursor impulse
      for (const p of particles) {
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < MOUSE_DIST * MOUSE_DIST && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const push = (1 - d / MOUSE_DIST) * 0.08;
            p.ix += (dx / d) * push;
            p.iy += (dy / d) * push;
          }
        }

        p.x += p.dvx + p.ix;
        p.y += p.dvy + p.iy;

        // only the cursor impulse decays — the base drift never stops
        p.ix *= 0.92;
        p.iy *= 0.92;
        const max = 1.4;
        if (p.ix > max) p.ix = max;
        else if (p.ix < -max) p.ix = -max;
        if (p.iy > max) p.iy = max;
        else if (p.iy < -max) p.iy = -max;

        // wrap around edges for an endless field
        if (p.x < -10) p.x = width + 10;
        else if (p.x > width + 10) p.x = -10;
        if (p.y < -10) p.y = height + 10;
        else if (p.y > height + 10) p.y = -10;

        // safety: respawn anything that ever becomes invalid
        if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
          Object.assign(p, makeParticle());
        }
      }

      // 2) particle-to-particle links (under the dots)
      ctx.lineWidth = 1;
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK_DIST * LINK_DIST) {
            const alpha = (1 - Math.sqrt(d2) / LINK_DIST) * 0.16;
            ctx.strokeStyle = `rgba(${ACCENT}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // 3) cursor links + the dots themselves
      for (const p of particles) {
        if (pointer.active) {
          const dx = p.x - pointer.x;
          const dy = p.y - pointer.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < MOUSE_DIST * MOUSE_DIST) {
            const alpha = (1 - Math.sqrt(d2) / MOUSE_DIST) * 0.55;
            ctx.strokeStyle = `rgba(${ACCENT_BRIGHT}, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
        ctx.fillStyle = `rgba(${ACCENT_BRIGHT}, 0.72)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const loop = () => {
      draw();
      raf = requestAnimationFrame(loop);
    };

    const start = () => {
      if (!raf) raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onLeave = () => {
      pointer.active = false;
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };

    resize();

    if (reduceMotion) {
      // static frame, no animation / no interaction
      draw();
      return undefined;
    }

    window.addEventListener('resize', resize);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerleave', onLeave);
    document.addEventListener('visibilitychange', onVisibility);
    start();

    return () => {
      stop();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas ref={canvasRef} className="cc-bg-canvas" aria-hidden="true" />;
}
