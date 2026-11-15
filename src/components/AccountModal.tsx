import { useEffect, useRef, useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { accountApi } from '../services/account-api';
import { ApiError, api } from '../services/api';
import type { AccountView } from '../types';
import { ModalSheet } from './ModalSheet';

export type AccountIntent = 'signup' | 'login' | 'account';
type Step = 'email' | 'code' | 'account';
/** The one request under way, so only the pressed control shows progress. */
type Pending = null | 'send' | 'check' | 'offers' | 'logout';

interface AccountModalProps {
  isOpen: boolean;
  intent: AccountIntent;
  account: AccountView | null;
  onClose: () => void;
  onAccountChange: (account: AccountView | null) => void;
}

/** The wording the server records as OFFERS_CONSENT.version (spec 16 checks they match). */
const OFFERS_CONSENT_TEXT = 'Email me monthly and holiday offers from Priyanshi. I can unsubscribe at any time.';
const NO_ACCOUNT_NEEDED = "You don't need an account to read or book.";
const RESEND_WAIT_S = 60;
const TITLE_ID = 'account-modal-title';

const messageOf = (err: unknown, fallback: string) => (err instanceof ApiError && err.message ? err.message : fallback);
/** The server's one-a-minute 429 names its wait ("Please wait 42 seconds..."); 0 for any other error. */
const waitOf = (err: unknown) =>
  err instanceof ApiError && err.status === 429 ? Number(/(\d+) seconds/.exec(err.message)?.[1] ?? 0) : 0;
const sameAccount = (a: AccountView | null, b: AccountView | null) =>
  a === b || (!!a && !!b && a.email === b.email && a.offersOptIn === b.offersOptIn);
/** Inert while a request is under way: still focusable (focus never drops to the page), but does nothing. */
const INERT = 'aria-disabled:opacity-40 aria-disabled:cursor-not-allowed';

/** Log in, Sign up and the small account view (email, offers setting, Log out). */
export function AccountModal({ isOpen, intent, account, onClose, onAccountChange }: AccountModalProps) {
  const [step, setStep] = useState<Step>('email');
  const [mode, setMode] = useState<'signup' | 'login'>('signup');
  const [email, setEmail] = useState('');
  const [offers, setOffers] = useState(false);
  const [honeypot, setHoneypot] = useState('');
  const [code, setCode] = useState('');
  const [pending, setPending] = useState<Pending>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState(false);
  const [waitLeft, setWaitLeft] = useState(0);
  const [heading, setHeading] = useState('Your account');
  /** Arrived here by entering a code: the view says where offers stand and offers a Done button. */
  const [verified, setVerified] = useState(false);
  const [status, setStatus] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  /** The error on screen is the one-a-minute wait: it goes when the wait ends. */
  const waitErrorRef = useRef(false);
  /** Bumped by every change made here, so a slower /me refresh never overwrites it. */
  const changeRef = useRef(0);
  const busy = pending !== null;

  const changeAccount = (next: AccountView | null) => {
    changeRef.current += 1;
    onAccountChange(next);
  };

  // Every opening starts clean (reset on open, so the closing sheet keeps its content).
  useEffect(() => {
    if (!isOpen) return;
    setStep(intent === 'account' ? 'account' : 'email');
    if (intent !== 'account') setMode(intent);
    setEmail('');
    setOffers(false);
    setHoneypot('');
    setCode('');
    setPending(null);
    setError(null);
    setFieldError(false);
    waitErrorRef.current = false;
    setWaitLeft(0);
    setHeading('Your account');
    setVerified(false);
    setStatus('');
    if (intent !== 'account') return;
    // The view could be stale (unsubscribed from an email, or logged out elsewhere): ask again.
    let live = true;
    const at = changeRef.current;
    api.getAccount().then(
      (res) => {
        if (!live || changeRef.current !== at || sameAccount(res.account, account)) return;
        changeAccount(res.account);
        if (!res.account) {
          setMode('login');
          setStep('email');
        }
      },
      () => {} // offline: the view stays as it was
    );
    return () => {
      live = false;
    };
    // Only on opening; `account` is read once, as it was then.
  }, [isOpen, intent]);

  // Focus goes to each step's heading, so screen readers hear where they are.
  useEffect(() => {
    if (isOpen) headingRef.current?.focus({ preventScroll: true });
  }, [isOpen, step, mode]);

  useEffect(() => {
    if (waitLeft > 0) {
      const id = window.setTimeout(() => setWaitLeft((s) => Math.max(0, s - 1)), 1000);
      return () => window.clearTimeout(id);
    }
    if (waitErrorRef.current) clearErrors();
  }, [waitLeft]);

  const fieldRef = () => (step === 'code' ? codeRef : emailRef);
  /** On a field error, focus goes to the field, so a keyboard user lands where the fix is. */
  const fail = (message: string, onField = true) => {
    setError(message);
    setFieldError(onField);
    if (onField) fieldRef().current?.focus();
  };
  function clearErrors() {
    waitErrorRef.current = false;
    setError(null);
    setFieldError(false);
  }

  const requestCode = async () => {
    setPending('send');
    clearErrors();
    try {
      await accountApi.requestAccountCode({ intent: mode, email, offersOptIn: mode === 'signup' && offers, website: honeypot });
      setWaitLeft(RESEND_WAIT_S);
      return true;
    } catch (err) {
      const wait = waitOf(err);
      fail(messageOf(err, "We couldn't send your email. Please try again."), err instanceof ApiError && err.status === 400);
      if (wait > 0) {
        waitErrorRef.current = true;
        setWaitLeft(wait);
      }
      return false;
    } finally {
      setPending(null);
    }
  };

  const submitEmail = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!email.trim()) return fail('Please enter your email address.');
    setStatus('');
    if (await requestCode()) {
      setCode('');
      setStep('code');
    }
  };

  const submitCode = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!/^\d{6}$/.test(code.trim())) return fail('Please enter the 6 digits from your email.');
    setPending('check');
    clearErrors();
    setStatus('');
    try {
      const res = await accountApi.verifyAccountCode({ email, code: code.trim() });
      changeAccount(res.account);
      setHeading(res.created ? 'Your account is ready' : "You're logged in");
      setVerified(true);
      setStatus('');
      setStep('account');
    } catch (err) {
      fail(messageOf(err, "That didn't work. Please try again."));
    } finally {
      setPending(null);
    }
  };

  // The code field keeps focus either way, so the button that was pressed never drops it.
  const resend = async () => {
    if (busy || waitLeft > 0) return;
    setStatus(''); // cleared first, so a second resend is announced again
    if (await requestCode()) {
      setCode('');
      setStatus('We sent a new code.');
    }
    codeRef.current?.focus();
  };

  const useDifferentEmail = () => {
    if (busy) return;
    clearErrors();
    setStatus('');
    setCode('');
    setStep('email');
  };

  const switchMode = () => {
    if (busy) return;
    clearErrors();
    setMode(mode === 'signup' ? 'login' : 'signup');
  };

  // Updates only from the server's reply, never optimistically.
  const toggleOffers = async () => {
    if (!account || busy) return;
    setPending('offers');
    clearErrors();
    try {
      const res = await accountApi.updateAccount({ offersOptIn: !account.offersOptIn });
      changeAccount(res.account);
      setStatus(res.account.offersOptIn ? 'Offers are on.' : 'Offers are off.');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        changeAccount(null);
        onClose();
        return;
      }
      fail(messageOf(err, "That didn't save. Please try again."), false);
    } finally {
      setPending(null);
    }
  };

  const logOut = async () => {
    if (busy) return;
    setPending('logout');
    clearErrors();
    try {
      await accountApi.logoutAccount();
      changeAccount(null);
      onClose();
    } catch (err) {
      fail(messageOf(err, "We couldn't log you out. Please try again."), false);
    } finally {
      setPending(null);
    }
  };

  const title =
    step === 'account' ? heading : step === 'code' ? 'Enter your code' : mode === 'signup' ? 'Sign up' : 'Log in';
  const fieldProps = (id: string) =>
    fieldError ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {};
  const errorBlock = (id?: string) =>
    error && (
      <div id={id} role="alert" className={ui.error}>
        {error}
      </div>
    );
  const inert = busy || undefined;
  const quiet = cn(
    'self-start inline-flex items-center min-h-11 text-sm text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink transition-colors duration-200',
    'aria-disabled:text-ink-soft aria-disabled:no-underline aria-disabled:cursor-not-allowed'
  );

  return (
    <ModalSheet isOpen={isOpen} onClose={onClose} labelledBy={TITLE_ID} closeLabel="Close account window" dismissible={!busy} keyboardAware>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className={cn(ui.eyebrow, 'text-accent-text')}>YogaPriyanshi · Dubai</span>
          <h2 id={TITLE_ID} ref={headingRef} tabIndex={-1} className={cn(ui.title, 'focus:outline-none')}>
            {title}
          </h2>
          {step === 'email' && <p className="text-sm leading-[1.5] text-ink-soft">{NO_ACCOUNT_NEEDED}</p>}
          {step === 'code' && (
            <p className="text-sm leading-[1.5] text-ink-soft break-words">
              We emailed <span className="font-medium text-ink">{email.trim()}</span>
              {mode === 'signup' ? (
                <> a 6-digit code. Enter it here within 10 minutes.</>
              ) : (
                <>
                  . If the email has a 6-digit code, enter it here within 10 minutes. If there&apos;s no account yet, the email
                  will say so.
                </>
              )}
            </p>
          )}
          {step === 'account' && verified && account && (
            <p data-testid="account-offers-state" className="text-sm leading-[1.5] text-ink-soft">
              {account.offersOptIn
                ? 'Offers by email are on. You can turn them off below at any time.'
                : 'Offers by email are off. You can turn them on below at any time.'}
            </p>
          )}
        </div>

        {step === 'email' && (
          <form onSubmit={submitEmail} noValidate className="flex flex-col gap-6">
            <div className="hidden" aria-hidden="true">
              <label htmlFor="account-website">Website (do not fill)</label>
              <input
                id="account-website"
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="account-email" className={ui.label}>
                Email
              </label>
              <input
                ref={emailRef}
                id="account-email"
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={254}
                readOnly={busy}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={ui.input}
                {...fieldProps('account-email')}
              />
            </div>
            {mode === 'signup' && (
              <label htmlFor="account-offers" className="flex items-start gap-3 min-h-11 text-sm leading-[1.5] text-ink cursor-pointer">
                <input
                  id="account-offers"
                  type="checkbox"
                  checked={offers}
                  aria-disabled={inert}
                  onChange={(e) => {
                    if (!busy) setOffers(e.target.checked);
                  }}
                  className="mt-0.5 size-5 shrink-0 accent-ink"
                />
                <span>{OFFERS_CONSENT_TEXT}</span>
              </label>
            )}
            {mode === 'signup' && (
              <p className="text-sm leading-[1.5] text-ink-soft">
                See how we use your email in our{' '}
                <a href="/privacy" target="_blank" rel="noopener" className="underline underline-offset-4 decoration-line-strong hover:decoration-ink text-ink">
                  privacy policy
                </a>
                .
              </p>
            )}
            {errorBlock('account-email-error')}
            <button type="submit" aria-disabled={inert} className={cn(ui.primary, INERT)}>
              {pending === 'send' ? 'Sending...' : 'Email me a code'}
            </button>
            <button type="button" onClick={switchMode} aria-disabled={inert} className={cn(quiet, '-mt-3')}>
              {mode === 'signup' ? 'Already have an account? Log in' : 'New here? Sign up'}
            </button>
          </form>
        )}

        {step === 'code' && (
          <form onSubmit={submitCode} noValidate className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="account-code" className={ui.label}>
                6-digit code
              </label>
              <input
                ref={codeRef}
                id="account-code"
                type="text"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                readOnly={busy}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                className={cn(ui.input, 'tabular-nums tracking-[0.14em]')}
                {...fieldProps('account-code')}
              />
            </div>
            {errorBlock('account-code-error')}
            <button type="submit" aria-disabled={inert} className={cn(ui.primary, INERT)}>
              {pending === 'check' ? 'Checking...' : 'Continue'}
            </button>
            <div className="-mt-3 flex flex-col">
              <button
                type="button"
                onClick={resend}
                aria-disabled={busy || waitLeft > 0 || undefined}
                className={cn(quiet, 'tabular-nums')}
              >
                {pending === 'send' ? 'Sending...' : waitLeft > 0 ? `Send a new code in ${waitLeft}s` : 'Send a new code'}
              </button>
              <button type="button" onClick={useDifferentEmail} aria-disabled={inert} className={quiet}>
                Use a different email
              </button>
            </div>
          </form>
        )}

        {step === 'account' && account && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <span className={ui.label}>Email</span>
              <span data-testid="account-email" className="text-base text-ink break-words">
                {account.email}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={account.offersOptIn}
              aria-disabled={inert}
              onClick={toggleOffers}
              className="press-soft flex w-full items-center justify-between gap-4 min-h-11 text-left text-sm leading-[1.5] text-ink transition duration-200 ease-spring active:duration-100 aria-disabled:opacity-60 aria-disabled:cursor-not-allowed"
            >
              <span>{OFFERS_CONSENT_TEXT}</span>
              <span
                aria-hidden="true"
                className={cn(
                  'relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200',
                  account.offersOptIn ? 'bg-ink' : 'bg-ink-faint'
                )}
              >
                <span
                  className={cn(
                    'absolute left-0.5 top-0.5 size-6 rounded-full bg-surface transition-transform duration-200 ease-spring motion-reduce:transition-none',
                    account.offersOptIn && 'translate-x-5'
                  )}
                />
              </span>
            </button>
            {errorBlock()}
            {verified && (
              <button type="button" onClick={() => !busy && onClose()} aria-disabled={inert} className={cn(ui.primary, INERT)}>
                Done
              </button>
            )}
            <button type="button" onClick={logOut} aria-disabled={inert} className={cn(ui.secondary, INERT, verified && '-mt-3')}>
              {pending === 'logout' ? 'One moment...' : 'Log out'}
            </button>
          </div>
        )}

        {/* Seen on the code step ("We sent a new code."); elsewhere it only speaks. */}
        <p role="status" className={step === 'code' && status ? 'text-sm leading-[1.5] text-ink-soft' : 'sr-only'}>
          {status}
        </p>
      </div>
    </ModalSheet>
  );
}
