import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * tailwind-merge only knows Tailwind's default font sizes, so it would read our `--text-*` tokens
 * (index.css) as colours and drop `text-h2` next to `text-ink`. Registering them keeps both.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ['display', 'h2', 'title', 'title-lg', 'quote', 'h3', 'h4'],
    },
  },
});

/** Joins class names and lets later Tailwind classes override earlier ones. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
