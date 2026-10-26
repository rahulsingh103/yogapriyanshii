import type { CSSProperties } from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FindClassLinkProps {
  onOpen: () => void;
  /** The words before the pill. */
  lead?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The entry to the class finder (Hero and the carousel): a short line, then a soft outlined pill.
 * Visible at a glance (owner request, 2026-10-25) but lighter than the section's one dark primary.
 */
export function FindClassLink({ onOpen, lead = 'Not sure?', className, style }: FindClassLinkProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2 text-sm leading-[1.5] text-ink-soft', className)} style={style}>
      <span>{lead}</span>
      <button
        type="button"
        onClick={onOpen}
        className="press-soft inline-flex items-center gap-2 min-h-11 px-5 rounded-full border border-line-strong bg-surface text-sm font-semibold text-ink hover:border-ink transition duration-200 ease-spring active:duration-100"
      >
        <Compass size={16} aria-hidden="true" className="text-accent-text" />
        Take the 30-second quiz
        <ArrowRight size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
