import { cn } from '@/lib/utils';

interface BuddhaLoaderProps {
  /** Width and height in px of the Buddha (the petal ring is drawn ~45% larger around it). */
  size?: number;
  /** Draw the turning petal ring around the Buddha. */
  ring?: boolean;
  className?: string;
}

/**
 * The site's loading mark (approved 2026-10-12, preview: design/concepts/buddha-loader.html):
 * a small, cute meditating Buddha who gently breathes while a ring of petals turns around him.
 * Purely decorative; pair it with visible or role="status" text. Motion stops under reduced motion.
 */
export function BuddhaLoader({ size = 64, ring = true, className }: BuddhaLoaderProps) {
  const outer = Math.round(size * 1.45);
  return (
    <span
      className={cn('relative inline-grid place-items-center shrink-0', className)}
      style={{ width: ring ? outer : size, height: ring ? outer : size }}
      aria-hidden="true"
    >
      {ring && (
        <svg viewBox="0 0 140 140" width={outer} height={outer} className="buddha-ring absolute inset-0">
          <g fill="none" className="stroke-accent" strokeWidth="1.4" opacity=".55">
            <path d="M70 6 q8 10 0 20 q-8 -10 0 -20Z" /><path d="M70 114 q8 10 0 20 q-8 -10 0 -20Z" />
            <path d="M6 70 q10 -8 20 0 q-10 8 -20 0Z" /><path d="M114 70 q10 -8 20 0 q-10 8 -20 0Z" />
            <path d="M22 22 q12 2 14 14 q-12 -2 -14 -14Z" /><path d="M104 104 q12 2 14 14 q-12 -2 -14 -14Z" />
            <path d="M118 22 q-2 12 -14 14 q2 -12 14 -14Z" /><path d="M36 104 q-2 12 -14 14 q2 -12 14 -14Z" />
          </g>
        </svg>
      )}
      <svg viewBox="0 0 120 120" width={size} height={size} className="buddha-breathe">
        <ellipse cx="60" cy="100" rx="42" ry="13" className="fill-line-strong" />
        <path d="M32 98 C30 78 40 60 60 60 C80 60 90 78 88 98 Z" className="fill-accent" />
        <path d="M60 62 C52 70 49 84 50 98" className="stroke-ink" strokeWidth="2" fill="none" strokeLinecap="round" opacity=".3" />
        <ellipse cx="60" cy="90" rx="13" ry="6.5" className="fill-skin" />
        <ellipse cx="60" cy="88.5" rx="5" ry="2.2" className="fill-cheek" opacity=".6" />
        <ellipse cx="39" cy="44" rx="5" ry="10" className="fill-skin" />
        <ellipse cx="81" cy="44" rx="5" ry="10" className="fill-skin" />
        <circle cx="60" cy="40" r="21" className="fill-skin" />
        <path d="M39 37 C40 22 50 16 60 16 C70 16 80 22 81 37 C76 30 68 27 60 27 C52 27 44 30 39 37 Z" className="fill-ink" opacity=".85" />
        <circle cx="60" cy="13" r="6.5" className="fill-ink" opacity=".85" />
        <circle cx="60" cy="31" r="1.6" className="fill-cheek" />
        <path d="M49 42 q4 3 8 0" className="stroke-ink" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <path d="M63 42 q4 3 8 0" className="stroke-ink" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        <circle cx="47" cy="49" r="3.2" className="fill-cheek" opacity=".55" />
        <circle cx="73" cy="49" r="3.2" className="fill-cheek" opacity=".55" />
        <path d="M55 51 q5 4 10 0" className="stroke-ink" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      </svg>
    </span>
  );
}
