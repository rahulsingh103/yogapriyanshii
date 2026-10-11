import { useEffect, useRef } from 'react';

/** [petal count, ring radius as a fraction of the half-size] (DESIGN_SYSTEM §7). */
const RINGS: ReadonlyArray<readonly [number, number]> = [
  [12, 0.16],
  [16, 0.28],
  [24, 0.42],
  [32, 0.58],
  [48, 0.76],
];

function readColours() {
  const styles = getComputedStyle(document.documentElement);
  return {
    accent: styles.getPropertyValue('--color-accent').trim() || 'currentColor',
    ink: styles.getPropertyValue('--color-ink').trim() || 'currentColor',
  };
}

function scrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
}

/**
 * The signature fine-line mandala: one fixed canvas behind the whole page that turns
 * and opens like a lotus as the page scrolls. Colours come from the CSS tokens.
 */
export function MandalaBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let colours = readColours();

    const draw = (p: number) => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const size = Math.round(canvas.clientWidth * dpr);
      if (!size) return;
      if (canvas.width !== size) {
        canvas.width = size;
        canvas.height = size;
      }
      ctx.clearRect(0, 0, size, size);
      const c = size / 2;
      ctx.save();
      ctx.translate(c, c);
      ctx.rotate(p * Math.PI * 0.75);
      const bloom = 0.62 + p * 0.45;

      RINGS.forEach(([n, rr], i) => {
        const R = c * rr * bloom;
        const petal = c * 0.11 * bloom * (1 + i * 0.12);
        const odd = i % 2 === 1;
        ctx.strokeStyle = odd ? colours.accent : colours.ink;
        ctx.globalAlpha = odd ? 0.42 : 0.16;
        ctx.lineWidth = dpr * (odd ? 1 : 0.8);
        ctx.beginPath();
        for (let k = 0; k < n; k++) {
          const a = (k / n) * Math.PI * 2 + (odd ? Math.PI / n : 0);
          const cos = Math.cos(a);
          const sin = Math.sin(a);
          // Rotate each petal's control points by `a` without a save/restore per petal.
          const pt = (x: number, y: number) => [x * cos - y * sin, x * sin + y * cos] as const;
          const [x0, y0] = pt(0, -R + petal * 0.2);
          const [x1, y1] = pt(petal * 0.45, -R - petal * 0.5);
          const [x2, y2] = pt(0, -R - petal);
          const [x3, y3] = pt(-petal * 0.45, -R - petal * 0.5);
          ctx.moveTo(x0, y0);
          ctx.quadraticCurveTo(x1, y1, x2, y2);
          ctx.quadraticCurveTo(x3, y3, x0, y0);
        }
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, R, 0, Math.PI * 2);
        ctx.strokeStyle = colours.ink;
        ctx.globalAlpha = 0.08;
        ctx.stroke();
      });

      ctx.beginPath();
      ctx.arc(0, 0, c * 0.05 * bloom, 0, Math.PI * 2);
      ctx.fillStyle = colours.accent;
      ctx.globalAlpha = 0.15;
      ctx.fill();
      ctx.restore();
      ctx.globalAlpha = 1;
    };

    // Reduced motion: drawn once, fully bloomed and still (redrawn only if the size changes).
    if (reduceMotion) {
      draw(1);
      const onResize = () => draw(1);
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }

    let frame = 0;
    const schedule = () => {
      if (frame || document.hidden) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        draw(scrollProgress());
      });
    };
    const onVisibility = () => {
      if (!document.hidden) {
        colours = readColours();
        schedule();
      }
    };

    draw(scrollProgress());
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
      <canvas
        ref={canvasRef}
        className="absolute left-1/2 top-1/2 size-[min(115vmin,980px)] -translate-x-1/2 -translate-y-1/2"
      />
    </div>
  );
}
