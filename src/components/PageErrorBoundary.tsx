import { Component, type ReactNode } from 'react';
import { ui } from '@/lib/ui';

/** Set before the one hard reload after a failed chunk; cleared once a page has mounted (App). */
export const CHUNK_RELOAD_KEY = 'yp-chunk-reload';

// Chrome, Firefox and Safari word a failed dynamic import differently; Vite adds its own preload error.
const CHUNK_ERROR =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS|ChunkLoadError/i;

const isChunkError = (error: unknown) =>
  error instanceof Error && (error.name === 'ChunkLoadError' || CHUNK_ERROR.test(error.message));

const readFlag = () => {
  try {
    return window.sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1';
  } catch {
    return true; // No storage: never risk a reload loop.
  }
};

export const clearChunkReloadFlag = () => {
  try {
    window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    // Storage blocked: nothing to clear.
  }
};

interface PageErrorBoundaryProps {
  children: ReactNode;
  /** The calm message is on screen: the preloader can fade. */
  onError: () => void;
}

interface PageErrorBoundaryState {
  failed: boolean;
  reloading: boolean;
}

/**
 * Around the lazy pages (class pages, the 404). A chunk that fails to load (usually a deploy that
 * replaced the old files) gets one hard reload, guarded by a sessionStorage flag so it can never loop.
 * Anything else, or a second failure, shows a calm message with a link home. Never a blank page.
 */
export class PageErrorBoundary extends Component<PageErrorBoundaryProps, PageErrorBoundaryState> {
  state: PageErrorBoundaryState = { failed: false, reloading: false };

  static getDerivedStateFromError(error: unknown): PageErrorBoundaryState {
    const reloading = isChunkError(error) && !readFlag();
    return { failed: true, reloading };
  }

  componentDidCatch() {
    if (this.state.reloading) {
      try {
        window.sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
      } catch {
        // readFlag() already returned true without storage, so this branch never runs then.
      }
      window.location.reload();
      return;
    }
    this.props.onError();
  }

  render() {
    if (!this.state.failed) return this.props.children;
    // The preloader still covers the page while it reloads.
    if (this.state.reloading) return <main className="flex-1" />;
    return (
      <main className="flex-1">
        <section
          aria-labelledby="page-error-title"
          className="max-w-[640px] mx-auto px-5 pt-32 pb-24 lg:pb-32 flex flex-col items-start gap-6"
        >
          <h1 id="page-error-title" className="font-display font-normal text-h2 text-ink text-balance">
            This page didn&apos;t load
          </h1>
          <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
            Please check your connection and try again in a moment.
          </p>
          <a href="/" className={ui.primary}>
            Back to the homepage
          </a>
        </section>
      </main>
    );
  }
}
