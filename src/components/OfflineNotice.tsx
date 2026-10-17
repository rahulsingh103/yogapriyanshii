import { useEffect, useState } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { BuddhaLoader } from './BuddhaLoader';

/** A calm pill at the bottom of the screen while the connection is down, and a short "Back online" after. */
export function OfflineNotice() {
  const [state, setState] = useState<'online' | 'offline' | 'back'>(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'online'
  );

  useEffect(() => {
    let timer: number | undefined;
    const goOffline = () => {
      window.clearTimeout(timer);
      setState('offline');
    };
    const goOnline = () => {
      setState((prev) => (prev === 'offline' ? 'back' : prev));
      timer = window.setTimeout(() => setState('online'), 2500);
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className="fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom,0px))] sm:bottom-6 z-[60] flex justify-center px-4 pointer-events-none">
      <AnimatePresence>
        {state !== 'online' && (
          <m.div
            key="connection-notice"
            data-testid="offline-notice"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
            className="pointer-events-auto flex items-center gap-3 rounded-full bg-surface border border-line shadow-raised pl-2 pr-5 py-2 text-sm text-ink"
          >
            <BuddhaLoader size={32} ring={false} />
            {state === 'offline' ? "You're offline. Reconnecting…" : 'Back online.'}
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}
