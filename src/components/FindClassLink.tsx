import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils';

interface FindClassLinkProps {
  onOpen: () => void;
  /** The quiet words before the link. */
  lead?: string;
  className?: string;
  style?: CSSProperties;
}

/**
 * The quiet entry to the class finder (Hero and the carousel): a line of text with a text button in
 * the How it works link style. No press scale and no pill, so the section's one primary stays primary.
 */
export function FindClassLink({ onOpen, lead = 'Not sure?', className, style }: FindClassLinkProps) {
  return (
    <p className={cn('text-sm leading-[1.5] text-ink-soft', className)} style={style}>
      {lead}{' '}
      <button
        type="button"
        onClick={onOpen}
        className="inline-flex items-center min-h-11 align-middle font-semibold text-ink underline underline-offset-4 decoration-line hover:decoration-ink transition-colors duration-200"
      >
        Find your class
      </button>
    </p>
  );
}
