import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { dubaiYmd, formatDay } from '@/lib/dubai-date';
import { accountApi } from '../services/account-api';
import { ApiError } from '../services/api';
import type { OfferSummary, OffersOverview } from '../types';

interface AdminOffersProps {
  token: string;
  /** A 401: the session ended, so the dashboard signs out. */
  onUnauthorized: () => void;
  /** Bumped by the dashboard's Refresh button. */
  refreshKey?: number;
}

/** Between batch calls: the server paces the sends inside each call (backend/offers.ts). */
const BATCH_GAP_MS = 1000;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const plural = (n: number) => `${n} subscriber${n === 1 ? '' : 's'}`;
const outcome = (o: OfferSummary) => `Sent ${o.sent}, not delivered ${o.failed}`;

/** Write, review the exact email, send. No subscriber list is ever shown or exported. */
export function AdminOffers({ token, onUnauthorized, refreshKey = 0 }: AdminOffersProps) {
  const [overview, setOverview] = useState<OffersOverview | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [sending, setSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState<OfferSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Which fields were empty at Review: their error sits just above the Review button. */
  const [invalid, setInvalid] = useState({ subject: false, body: false });
  const liveRef = useRef(true);
  // The dashboard passes a new function each render; only a new token or Refresh should fetch again.
  const onUnauthorizedRef = useRef(onUnauthorized);
  onUnauthorizedRef.current = onUnauthorized;
  const runningRef = useRef(false);
  const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
  const subjectRef = useRef<HTMLInputElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  /** Where focus goes when the review closes: back to the Subject, or to the progress card after Send. */
  const afterReviewRef = useRef<'subject' | 'progress' | null>(null);

  const handleError = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 401) return onUnauthorizedRef.current();
    setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await accountApi.getOffers(token);
      if (liveRef.current) setOverview(data);
    } catch (err) {
      if (liveRef.current) handleError(err);
    }
  }, [token, handleError]);

  useEffect(() => {
    liveRef.current = true;
    load();
    return () => {
      // Leaving the tab stops the calls; "Continue sending" picks up from the same recipients.
      liveRef.current = false;
    };
  }, [load, refreshKey]);

  useEffect(() => {
    if (reviewing) return reviewHeadingRef.current?.focus({ preventScroll: true });
    const target = afterReviewRef.current === 'progress' ? progressRef.current : afterReviewRef.current === 'subject' ? subjectRef.current : null;
    afterReviewRef.current = null;
    target?.focus({ preventScroll: true });
  }, [reviewing]);

  const run = async (id: string) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setSending(true);
    setPaused(false);
    setError(null);
    try {
      for (;;) {
        const res = await accountApi.sendOfferBatch(token, id);
        if (!liveRef.current) return;
        setProgress(res.offer);
        if (res.paused) setPaused(true);
        if (res.paused || res.offer.status === 'done') break;
        await delay(BATCH_GAP_MS);
        if (!liveRef.current) return;
      }
      await load();
    } catch (err) {
      if (liveRef.current) {
        handleError(err);
        await load();
      }
    } finally {
      runningRef.current = false;
      if (liveRef.current) setSending(false);
    }
  };

  const review = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const empty = { subject: !subject.trim(), body: !body.trim() };
    setInvalid(empty);
    if (empty.subject || empty.body) {
      setError('Please write a subject and a message.');
      return;
    }
    setReviewing(true);
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const res = await accountApi.createOffer(token, { subject, body });
      if (!liveRef.current) return;
      setProgress(res.offer);
      afterReviewRef.current = 'progress';
      setReviewing(false);
      setSubject('');
      setBody('');
      await run(res.offer.id);
    } catch (err) {
      if (liveRef.current) {
        handleError(err);
        setSending(false);
      }
    }
  };

  if (!overview) {
    return error ? (
      <div role="alert" className={ui.error}>
        {error}
      </div>
    ) : (
      <p role="status" className="text-sm text-ink-soft">
        Loading offers...
      </p>
    );
  }

  const unfinished = overview.current;
  const shown = progress ?? unfinished;
  const count = overview.subscribers;
  // Next to the buttons it is about: while reviewing, and for empty fields; otherwise at the top.
  const where = reviewing ? 'review' : invalid.subject || invalid.body ? 'form' : 'top';
  const errorBlock = error && (
    <div role="alert" className={ui.error}>
      {error}
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <h3 className="font-display font-normal text-h3 text-ink">Offers</h3>
        <p data-testid="offers-subscribers" className="text-sm text-ink-soft">
          {plural(count)} chose to get offers by email. Plain text, sent from your studio address.
        </p>
      </div>

      {where === 'top' && errorBlock}

      {shown && (shown.status === 'sending' || progress) && (
        <div
          ref={progressRef}
          tabIndex={-1}
          data-testid="offer-progress"
          className="bg-surface-alt rounded-[16px] p-4 sm:p-5 flex flex-col gap-3 text-sm focus:outline-none"
        >
          <span className={ui.eyebrow}>{shown.status === 'done' ? 'Finished' : sending ? 'Sending' : 'Not finished'}</span>
          <p className="font-semibold text-ink break-words">{shown.subject}</p>
          <p role="status" className="text-ink tabular-nums">
            {outcome(shown)}
            {shown.status === 'sending' ? `, ${shown.remaining} still to send` : ''}
            {shown.skipped > 0 ? ` (${shown.skipped} unsubscribed before their turn)` : ''}
          </p>
          {paused && (
            <p className="text-ink-soft">The daily limit is reached, so sending has paused. Continue once a day has passed.</p>
          )}
          {shown.status === 'sending' && !sending && (
            <button type="button" onClick={() => run(shown.id)} className={cn(ui.secondary, 'w-full sm:w-auto sm:self-start')}>
              Continue sending
            </button>
          )}
        </div>
      )}

      {reviewing ? (
        <div className="flex flex-col gap-6">
          <h4 ref={reviewHeadingRef} tabIndex={-1} className="font-display font-normal text-h4 text-ink focus:outline-none">
            Check the email
          </h4>
          <div data-testid="offer-review" className="bg-surface-alt rounded-[16px] p-4 sm:p-5 flex flex-col gap-3 text-sm">
            <p className="font-semibold text-ink break-words">{subject.trim()}</p>
            <p className="text-ink leading-[1.6] whitespace-pre-wrap break-words">{body.trim()}</p>
            <p className="text-ink-soft leading-[1.6] whitespace-pre-wrap break-words">{overview.footer}</p>
          </div>
          {where === 'review' && errorBlock}
          <div className="flex flex-col sm:flex-row gap-3">
            <button type="button" onClick={send} disabled={sending || count === 0} className={ui.primary}>
              {sending ? 'Starting...' : `Send to ${plural(count)}`}
            </button>
            <button
              type="button"
              onClick={() => {
                afterReviewRef.current = 'subject';
                setReviewing(false);
              }}
              disabled={sending}
              className={ui.secondary}
            >
              Back to editing
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={review} noValidate className="flex flex-col gap-6 max-w-xl">
          <div className="flex flex-col gap-2">
            <label htmlFor="offer-subject" className={ui.label}>
              Subject
            </label>
            <input
              ref={subjectRef}
              id="offer-subject"
              type="text"
              maxLength={120}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              aria-invalid={invalid.subject || undefined}
              className={ui.input}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="offer-body" className={ui.label}>
              Message
            </label>
            <textarea
              id="offer-body"
              rows={8}
              maxLength={5000}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              aria-invalid={invalid.body || undefined}
              aria-describedby="offer-body-help"
              className={ui.textarea}
            />
            <p id="offer-body-help" className="text-sm leading-[1.5] text-ink-soft">
              An unsubscribe footer is added to every email. You&apos;ll check the email before it goes.
            </p>
          </div>
          {where === 'form' && errorBlock}
          <button
            type="submit"
            disabled={sending || count === 0 || unfinished !== null}
            className={cn(ui.primary, 'w-full sm:w-auto sm:self-start')}
          >
            Review
          </button>
          {unfinished !== null && !sending && <p className="text-sm text-ink-soft">Finish the offer above before starting a new one.</p>}
        </form>
      )}

      <div className="flex flex-col gap-3">
        <h4 className="font-display font-normal text-h4 text-ink">Recent offers</h4>
        {overview.offers.length === 0 ? (
          <p className="text-sm text-ink-soft">No offers sent yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {overview.offers.map((o) => (
              <li key={o.id} data-testid="offer-row" className="bg-surface-alt rounded-[16px] p-4 sm:p-5 flex flex-col gap-1 text-sm">
                <span className="font-semibold text-ink break-words">{o.subject}</span>
                <span className="text-ink-soft tabular-nums">
                  {formatDay(dubaiYmd(o.createdAt))} · {outcome(o)}
                  {o.status === 'sending' ? ', not finished' : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
