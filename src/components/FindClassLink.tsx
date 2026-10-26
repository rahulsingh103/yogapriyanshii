import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface FindClassLinkProps {
  onOpen: () => void;
  /** The words before the link. */
  lead?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The entry to the class finder (Hero and the carousel): a line of text with an underlined text
 * button in the How it works link style. No press scale and no pill, so the section's one primary
 * stays primary. 16px, the hero subtitle's size, so it is easy to notice (owner request, 2026-10-25).
 */
export function FindClassLink({ onOpen, lead = 'Not sure?', className, style }: FindClassLinkProps) {
  return (
    <p className={cn('flex flex-wrap items-center gap-x-1.5 text-base leading-[1.5] text-ink-soft', className)} style={style}>
      <span>{lead}</span>
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center min-h-11 text-base leading-[1.5] font-medium text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink transition-colors duration-200"
      >
        Take the 30-second quiz
      </button>
    </p>
  );
}
