import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Search } from 'lucide-react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowLeft } from '@/components/animate-ui/icons/arrow-left';
import { Check } from '@/components/animate-ui/icons/check';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { api } from '../services/api';
import { Booking, ClassSession } from '../types';
import { ModalSheet } from './ModalSheet';

interface CancelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCancelled?: () => void;
}

export const CancelModal: React.FC<CancelModalProps> = ({
  isOpen,
  onClose,
  onCancelled,
}) => {
  const [tokenInput, setTokenInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  // Looked up booking state
  const [lookedUpBooking, setLookedUpBooking] = useState<Booking | null>(null);
  const [lookedUpSession, setLookedUpSession] = useState<ClassSession | null>(null);
  const [cancelledBooking, setCancelledBooking] = useState<Booking | null>(null);
  const cancelledHeadingRef = useRef<HTMLHeadingElement>(null);

  // Screen readers hear the result: focus moves to the "Reservation Cancelled" heading.
  useEffect(() => {
    if (cancelledBooking) cancelledHeadingRef.current?.focus();
  }, [cancelledBooking]);

  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanToken = tokenInput.trim().toUpperCase();
    if (!cleanToken) {
      setError('Please enter your booking reference token.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setResultMessage(null);

      const res = await api.getBooking(cleanToken);
      setLookedUpBooking(res.booking);
      setLookedUpSession(res.session);
    } catch (err: any) {
      setError(err?.message || 'No reservation found matching this token.');
      setLookedUpBooking(null);
      setLookedUpSession(null);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubmit = async () => {
    if (!lookedUpBooking) return;

    try {
      setLoading(true);
      setError(null);
      setResultMessage(null);

      const res = await api.cancelBooking(lookedUpBooking.bookingToken);
      setCancelledBooking(res.booking);
      setResultMessage(res.message);
      setLookedUpBooking(null);
      if (onCancelled) onCancelled();
    } catch (err: any) {
      setError(err?.message || 'Failed to cancel reservation.');
    } finally {
      setLoading(false);
    }
  };

  // Every opening starts from a clean lookup form (reset on open, so the closing sheet keeps its content).
  useEffect(() => {
    if (isOpen) handleReset();
  }, [isOpen]);

  const handleReset = () => {
    setTokenInput('');
    setError(null);
    setResultMessage(null);
    setLookedUpBooking(null);
    setLookedUpSession(null);
    setCancelledBooking(null);
  };

  const getNoticeHours = () => {
    if (!lookedUpSession) return null;
    const sessionTime = new Date(lookedUpSession.startTimeUtc).getTime();
    const now = Date.now();
    return Math.max(0, (sessionTime - now) / (1000 * 60 * 60));
  };

  const noticeHours = getNoticeHours();
  const isFreeCancel = noticeHours !== null && noticeHours >= 6;

  const titleId = 'cancel-modal-title';
  const row = 'flex justify-between gap-4 py-2 border-b border-line last:border-b-0';

  return (
    <ModalSheet isOpen={isOpen} onClose={onClose} labelledBy={titleId} closeLabel="Close modal" dismissible={!loading}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className={cn(ui.eyebrow, 'text-accent-text')}>YogaPriyanshi · Dubai</span>
          <h2 id={titleId} className={ui.title}>
            Manage Reservation
          </h2>
          <p className="text-sm leading-[1.5] text-ink-soft">
            Look up booking details or cancel according to the studio 6-hour policy.
          </p>
        </div>

        {error && (
          <div role="alert" className={cn(ui.error, 'flex items-start gap-2')}>
            <AlertCircle className="size-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* STATE 1: Cancelled successfully */}
        {resultMessage && cancelledBooking ? (
          <div className="flex flex-col items-center gap-6 text-center">
            <span className="inline-flex items-center justify-center size-12 rounded-full bg-calm-bg text-success">
              <Check size={22} animateOnView animateOnViewOnce aria-hidden="true" />
            </span>
            <h3
              ref={cancelledHeadingRef}
              tabIndex={-1}
              className="font-display font-normal text-h3 text-ink focus:outline-none"
            >
              Reservation Cancelled
            </h3>
            <dl className="w-full text-sm text-left">
              <div className={row}>
                <dt className="text-ink-soft">Booking Token:</dt>
                <dd className="font-semibold tabular-nums text-ink">{cancelledBooking.bookingToken}</dd>
              </div>
              <div className={row}>
                <dt className="text-ink-soft">Class:</dt>
                <dd className="font-medium text-ink">{cancelledBooking.sessionTitle}</dd>
              </div>
              <div className={row}>
                <dt className="text-ink-soft">Credit Policy:</dt>
                <dd
                  className={cn(
                    'font-semibold uppercase tracking-[0.1em] text-xs self-center',
                    cancelledBooking.creditStatus === 'refunded' ? 'text-success' : 'text-error'
                  )}
                >
                  {cancelledBooking.creditStatus === 'refunded' ? 'Refunded' : 'Burned (Late Notice)'}
                </dd>
              </div>
            </dl>
            <p className="text-sm leading-[1.6] text-ink-soft">{resultMessage}</p>
            <button type="button" onClick={onClose} className={cn(ui.primary, 'w-full')}>
              Done & Return to Studio
            </button>
          </div>
        ) : lookedUpBooking ? (
          /* STATE 2: Looked up booking details */
          <div className="flex flex-col gap-6">
            <dl className={cn(ui.panel, 'text-sm')}>
              <div className={cn(row, 'items-center')}>
                <dt className={ui.eyebrow}>Status</dt>
                <dd
                  className={cn(
                    'text-xs font-semibold uppercase tracking-[0.1em] px-3 py-1 rounded-full',
                    lookedUpBooking.status === 'confirmed' ? 'bg-surface text-success' : 'bg-error-bg text-error'
                  )}
                >
                  {lookedUpBooking.status}
                </dd>
              </div>
              {(
                [
                  ['Student', lookedUpBooking.customerName],
                  ['Email', lookedUpBooking.customerEmail],
                  ['Class', lookedUpBooking.sessionTitle],
                  ['Time', lookedUpBooking.sessionTimeDubai],
                  [
                    'Format',
                    lookedUpBooking.mode === 'in_person'
                      ? 'In person'
                      : 'Online Stream',
                  ],
                  ['Token', lookedUpBooking.bookingToken],
                ] as const
              ).map(([term, value]) => (
                <div key={term} className={row}>
                  <dt className={ui.eyebrow}>{term}</dt>
                  <dd className="font-medium text-ink text-right break-all">{value}</dd>
                </div>
              ))}
            </dl>

            {/* Policy evaluation */}
            {lookedUpBooking.status === 'confirmed' ? (
              <div className={cn(isFreeCancel ? ui.notice : ui.error, 'flex flex-col gap-1')}>
                <p className={cn('font-semibold', isFreeCancel ? 'text-success' : 'text-error')}>
                  {isFreeCancel ? 'Eligible for Free Cancellation' : 'Late Cancellation Notice'}
                </p>
                <p>
                  {isFreeCancel
                    ? `You are cancelling ${noticeHours?.toFixed(1)} hours before class (≥ 6h). Your seat will be released and your class credit will be refunded.`
                    : `You are cancelling less than 6 hours before class (${noticeHours?.toFixed(1)}h remaining). Your seat will be released, but your class credit is burned per studio policy.`}
                </p>
              </div>
            ) : (
              <div className={ui.notice}>This reservation has already been cancelled. No further action needed.</div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
              <AnimateIcon animateOnHover asChild>
                <button type="button" onClick={handleReset} className={ui.secondary}>
                  <ArrowLeft size={14} aria-hidden="true" />
                  Look Up Another
                </button>
              </AnimateIcon>

              {lookedUpBooking.status === 'confirmed' && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCancelSubmit}
                  className={cn(ui.primary, 'bg-error')}
                >
                  {loading ? 'Processing...' : 'Confirm Cancellation'}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* STATE 3: Token input form */
          <form onSubmit={handleLookup} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="cancel-token" className={ui.label}>
                Booking Reference Token
              </label>
              <input
                id="cancel-token"
                type="text"
                required
                autoComplete="off"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                placeholder="e.g. YP-8K2N9F"
                className={cn(ui.input, 'tracking-[0.04em]')}
              />
              <p className="text-sm leading-[1.5] text-ink-soft">
                Paste your booking reference (starts with YP-) from your confirmation screen or email.
              </p>
            </div>

            <div className={cn(ui.panel, 'text-sm leading-[1.5] text-ink-soft flex flex-col gap-1')}>
              <p className="font-semibold text-ink">Cancellation Policy:</p>
              <p>
                • <strong className="font-semibold text-ink">Free up to 6 hours</strong> before start: Releases seat & refunds credit.
              </p>
              <p>
                • <strong className="font-semibold text-ink">Late (&lt; 6 hours)</strong>: Releases seat to waitlist, credit is burned.
              </p>
            </div>

            <button type="submit" disabled={loading} className={cn(ui.primary, 'w-full')}>
              <Search className="size-4" aria-hidden="true" />
              <span>{loading ? 'Searching...' : 'Find My Reservation'}</span>
            </button>
          </form>
        )}
      </div>
    </ModalSheet>
  );
};
