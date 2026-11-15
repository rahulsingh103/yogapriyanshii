import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { useLenis } from 'lenis/react';
import { UNSUBSCRIBE_META, setDocumentHead } from '@/lib/page-meta';
import { isPlainClick } from '@/hooks/use-route';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { accountApi } from '../services/account-api';
import { ApiError } from '../services/api';

interface UnsubscribePageProps {
  /** Called once mounted, so the preloader can fade. */
  onReady: () => void;
  onNavigateHome: () => void;
}

type State = 'ready' | 'sending' | 'done' | 'invalid';

const tokenFromUrl = () => {
  const token = new URLSearchParams(window.location.search).get('token');
  return token && /^[0-9a-f]{64}$/.test(token) ? token : null;
};

/** Loading this page changes nothing (mail scanners open links): only the button unsubscribes. No login. */
export function UnsubscribePage({ onReady, onNavigateHome }: UnsubscribePageProps) {
  const lenis = useLenis();
  const [token] = useState(tokenFromUrl);
  const [state, setState] = useState<State>(token ? 'ready' : 'invalid');
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setDocumentHead(UNSUBSCRIBE_META);
    lenis?.scrollTo(0, { immediate: true, force: true });
    window.scrollTo(0, 0);
    onReady();
    // Once, on mount.
  }, []);

  useEffect(() => {
    if (state === 'done' || (state === 'invalid' && token)) headingRef.current?.focus({ preventScroll: true });
  }, [state, token]);

  // The button was disabled while sending, so focus fell to the page: after a failure it goes back.
  useEffect(() => {
    if (error) buttonRef.current?.focus({ preventScroll: true });
  }, [error]);

  const confirm = async () => {
    if (!token) return;
    setState('sending');
    setError(null);
    try {
      await accountApi.unsubscribeOffers(token);
      setState('done');
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setState('invalid');
        return;
      }
      setError(err instanceof ApiError ? err.message : "That didn't work. Please try again.");
      setState('ready');
    }
  };

  const goHome = (e: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainClick(e)) return;
    e.preventDefault();
    // Lenis (anchors: true) listens on window.
    e.stopPropagation();
    onNavigateHome();
  };

  const home = (
    <a href="/" onClick={goHome} className={cn(state === 'done' || state === 'invalid' ? ui.primary : ui.secondary, 'w-full sm:w-auto')}>
      Back to the homepage
    </a>
  );

  return (
    <main className="flex-1">
      <section aria-labelledby="unsubscribe-title" className="max-w-[640px] mx-auto px-5 pt-32 pb-24 lg:pb-32 flex flex-col items-start gap-6">
        <h1 id="unsubscribe-title" ref={headingRef} tabIndex={-1} className="font-display font-normal text-h2 text-ink text-balance focus:outline-none">
          {state === 'done' ? "You're unsubscribed" : state === 'invalid' ? "This link doesn't work" : 'Unsubscribe from offers'}
        </h1>
        {state === 'done' ? (
          <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
            We won&apos;t send you any more offers. You can turn them back on in your account at any time.
          </p>
        ) : state === 'invalid' ? (
          <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
            You can still turn offers off by logging in and opening your account.
          </p>
        ) : (
          <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
            This stops monthly and holiday offers from Priyanshi. Emails about classes you book still arrive.
          </p>
        )}
        {error && (
          <div role="alert" className={cn(ui.error, 'w-full')}>
            {error}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          {(state === 'ready' || state === 'sending') && (
            <button ref={buttonRef} type="button" onClick={confirm} disabled={state === 'sending'} className={cn(ui.primary, 'w-full sm:w-auto')}>
              {state === 'sending' ? 'One moment...' : 'Unsubscribe'}
            </button>
          )}
          {home}
        </div>
      </section>
    </main>
  );
}
