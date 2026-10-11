import React, { useState, useEffect, useRef } from 'react';
import { Calendar, ChevronDown, Mail } from 'lucide-react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowLeft } from '@/components/animate-ui/icons/arrow-left';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { Check } from '@/components/animate-ui/icons/check';
import { Copy } from '@/components/animate-ui/icons/copy';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { api, ApiError } from '../services/api';
import { ClassSession, ClassStyle, Booking, EmailNotification } from '../types';
import { ModalSheet } from './ModalSheet';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedSession?: ClassSession | null;
  /** From a carousel card: preselect the soonest available session of this style. */
  preselectedStyle?: ClassStyle | null;
  initialPlanKey?: 'free' | 'single' | 'pack10' | 'pack20';
  onBookingSuccess?: (booking: Booking) => void;
}

const PLANS = [
  { key: 'free', name: 'First Class', price: 'Free', aed: 0, tag: 'Intro' },
  { key: 'single', name: 'Single Drop-in', price: 'AED 350', aed: 350, tag: '1 Class' },
  { key: 'pack10', name: '10 Pack', price: 'AED 3,000', aed: 3000, tag: 'AED 300/cl' },
  { key: 'pack20', name: '20 Pack', price: 'AED 5,600', aed: 5600, tag: '+1 Private' },
] as const;

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  preselectedSession,
  preselectedStyle,
  initialPlanKey = 'free',
  onBookingSuccess,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [sessions, setSessions] = useState<ClassSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [planKey, setPlanKey] = useState<'free' | 'single' | 'pack10' | 'pack20'>(initialPlanKey);
  const [mode, setMode] = useState<'in_person' | 'online'>('in_person');

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // Payment states
  // Paid classes are settled at the studio until a real payment provider exists.
  const paymentMethod = 'studio' as const;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [dispatchedEmails, setDispatchedEmails] = useState<EmailNotification[]>([]);
  const [activeEmailTab, setActiveEmailTab] = useState<'student' | 'studio'>('student');
  const [showEmailDetails, setShowEmailDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  // 'notice' is the calm style for the rebook-refused message; 'error' is for real problems.
  const [errorTone, setErrorTone] = useState<'error' | 'notice'>('error');
  const [noOtherSessions, setNoOtherSessions] = useState(false);
  const [focusError, setFocusError] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const confirmedHeadingRef = useRef<HTMLHeadingElement>(null);

  // Screen readers hear the result: focus moves to the "You're on the mat." heading.
  useEffect(() => {
    if (step === 3 && confirmedBooking) confirmedHeadingRef.current?.focus();
  }, [step, confirmedBooking]);

  // After a refused rebook sends the student back to step 1, move focus to the message
  // so it isn't lost on <body>.
  useEffect(() => {
    if (focusError && error && errorRef.current) {
      errorRef.current.focus();
      setFocusError(false);
    }
  }, [focusError, error, step]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setErrorTone('error');
      setNoOtherSessions(false);
      setConfirmedBooking(null);
      setDispatchedEmails([]);
      setShowEmailDetails(false);
      setStep(1);
      if (initialPlanKey) {
        setPlanKey(initialPlanKey);
      }

      api
        .getSchedule()
        .then((data) => {
          const available = data.filter((s) => !s.isRestDay && s.status === 'available');
          setSessions(available);
          const soonestOfStyle = preselectedStyle
            ? available
                .filter((s) => s.style === preselectedStyle)
                .sort((a, b) => Date.parse(a.startTimeUtc) - Date.parse(b.startTimeUtc))[0]
            : undefined;
          if (preselectedSession && preselectedSession.status === 'available') {
            setSelectedSessionId(preselectedSession.id);
          } else if (soonestOfStyle) {
            setSelectedSessionId(soonestOfStyle.id);
          } else if (available.length > 0 && !selectedSessionId) {
            setSelectedSessionId(available[0].id);
          }
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Unable to load the live schedule.');
        });
    }
  }, [isOpen, preselectedSession, preselectedStyle, initialPlanKey]);

  const currentPlan = PLANS.find((p) => p.key === planKey) || PLANS[0];
  const currentSession = sessions.find((s) => s.id === selectedSessionId) || preselectedSession;

  const handleNextStep = () => {
    setError(null);
    setErrorTone('error');
    if (step === 1) {
      if (!selectedSessionId) {
        setError('Please select an upcoming class session.');
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!fullName.trim() || !email.trim()) {
        setError('Please provide your name and email address.');
        return;
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        setError('Please enter a valid email address.');
        return;
      }
      handleCompleteBooking();
    }
  };

  const handleCompleteBooking = async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await api.createBooking({
        sessionId: selectedSessionId,
        fullName: fullName.trim(),
        email: email.trim(),
        mode,
        planKey,
        paymentMethod: planKey === 'free' ? 'complimentary' : paymentMethod,
      });

      setConfirmedBooking(result.booking);
      if (result.dispatchedEmails) {
        setDispatchedEmails(result.dispatchedEmails);
      }
      setStep(3);
      if (onBookingSuccess) {
        onBookingSuccess(result.booking);
      }
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'session_rebook_blocked') {
        // A session this person cancelled can't be rebooked: offer the other open sessions instead.
        const others = sessions.filter((s) => s.id !== selectedSessionId);
        setSessions(others);
        setSelectedSessionId(others[0]?.id ?? '');
        setNoOtherSessions(others.length === 0);
        setErrorTone('notice');
        setFocusError(true);
        setStep(1);
      } else {
        setErrorTone('error');
      }
      setError(err?.message || 'Booking could not be completed.');
    } finally {
      setLoading(false);
    }
  };

  const copyToken = () => {
    if (confirmedBooking?.bookingToken) {
      navigator.clipboard.writeText(confirmedBooking.bookingToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // The studio address inside a message becomes a mailto: link.
  const renderMessage = (text: string) => {
    const match = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (!match || match.index === undefined) return text;
    const address = match[0];
    return (
      <>
        {text.slice(0, match.index)}
        <a href={`mailto:${address}`} className="underline underline-offset-2 font-medium text-ink hover:text-accent-text">
          {address}
        </a>
        {text.slice(match.index + address.length)}
      </>
    );
  };

  const studentEmail = dispatchedEmails.find((e) => e.type === 'student_confirmation');
  const studioAlertEmail = dispatchedEmails.find((e) => e.type === 'studio_alert');

  const getGoogleCalendarUrl = () => {
    if (!currentSession) return '#';
    const title = encodeURIComponent(`Yoga with Priyanshi: ${currentSession.className}`);
    const details = encodeURIComponent(
      `BurJuman Residence Block D, Dubai\nBooking Token: ${confirmedBooking?.bookingToken || ''}\nInstructor: Priyanshi`
    );
    const location = encodeURIComponent('BurJuman Residence Block D, Bur Dubai, Dubai, UAE');
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}`;
  };

  const titleId = 'booking-modal-title';

  return (
    <ModalSheet isOpen={isOpen} onClose={onClose} labelledBy={titleId} closeLabel="Close modal">
      <div className="flex flex-col gap-6">
        {/* Step indicator and heading */}
        {!confirmedBooking && (
          <div className="flex flex-col gap-2">
            <p className={cn(ui.eyebrow, 'flex flex-wrap items-center gap-2')}>
              <span className="text-accent-text">Step {step} of 2</span>
              <span aria-hidden="true">·</span>
              <span>{step === 1 ? 'Package & Slot' : 'Student & Checkout'}</span>
            </p>
            <h2 id={titleId} className={ui.title}>
              {step === 1 ? 'Select practice' : 'Your details'}
            </h2>
            <p className="text-sm leading-[1.5] text-ink-soft">BurJuman Residence Block D · Dubai</p>
          </div>
        )}

        {/* Error or calm notice */}
        {error && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className={cn(errorTone === 'notice' ? ui.notice : ui.error, 'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-text')}
          >
            {errorTone === 'notice' ? renderMessage(error) : error}
          </div>
        )}

        {/* ================= STEP 1: Package & Session ================= */}
        {step === 1 && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap justify-between items-baseline gap-x-4 gap-y-1">
                <span className={ui.label}>Package</span>
                <span className="text-xs text-ink-soft">
                  {currentPlan.aed === 0 ? 'Complimentary introductory class' : 'Flexible studio credits'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PLANS.map((p) => {
                  const isSelected = planKey === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setPlanKey(p.key as any)}
                      className={cn(
                        'min-h-[88px] p-3 text-left rounded-[12px] border flex flex-col justify-between gap-1 transition-colors duration-200',
                        isSelected
                          ? 'bg-ink border-ink text-on-ink'
                          : 'bg-surface-alt border-transparent text-ink hover:border-line-strong'
                      )}
                    >
                      <span
                        className={cn(
                          'text-xs font-semibold uppercase tracking-[0.14em]',
                          isSelected ? 'text-on-ink/75' : 'text-ink-soft'
                        )}
                      >
                        {p.tag}
                      </span>
                      <span className="text-lg font-semibold leading-tight tabular-nums">{p.price}</span>
                      <span className={cn('text-xs truncate', isSelected ? 'text-on-ink/75' : 'text-ink-soft')}>
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className={ui.label}>Format</span>
              <div className="grid grid-cols-2 gap-1 p-1 bg-surface-alt rounded-full">
                {(
                  [
                    [
                      'in_person',
                      <>
                        In-Person<span className="hidden sm:inline"> (BurJuman)</span>
                      </>,
                    ],
                    ['online', 'Online Live Stream'],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={mode === value}
                    onClick={() => setMode(value)}
                    className={cn(
                      'min-h-11 px-3 rounded-full text-sm font-medium transition-colors duration-200',
                      mode === value ? 'bg-ink text-on-ink' : 'text-ink-soft hover:text-ink'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap justify-between items-baseline gap-x-4 gap-y-1">
                <label htmlFor="booking-session" className={ui.label}>
                  Class & Time
                </label>
                <span className="text-xs text-ink-soft">Asia/Dubai (GMT+4)</span>
              </div>
              {noOtherSessions ? (
                <p className={ui.notice}>No other open sessions right now — please contact the studio.</p>
              ) : (
                <div className="relative">
                  <select
                    id="booking-session"
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    className={cn(ui.input, 'appearance-none pr-10 cursor-pointer truncate')}
                  >
                    {sessions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.className} — {s.dateDubai} at {s.timeDubai} ({s.spotsLeft} spots)
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    className="size-4 text-ink-soft absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                    aria-hidden="true"
                  />
                </div>
              )}
            </div>

            <AnimateIcon animateOnHover asChild>
              <button type="button" onClick={handleNextStep} disabled={noOtherSessions} className={cn(ui.primary, 'w-full')}>
                <span>Continue to Checkout</span>
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            </AnimateIcon>
          </div>
        )}

        {/* ================= STEP 2: Details & Checkout ================= */}
        {step === 2 && (
          <div className="flex flex-col gap-6">
            {/* Order summary */}
            <div className={cn(ui.panel, 'flex items-center justify-between gap-4')}>
              <div className="flex flex-col gap-1 min-w-0">
                <p className="font-display text-[24px] leading-[1.1] text-ink">{currentSession?.className}</p>
                <p className="text-sm text-ink-soft">
                  {currentSession?.dateDubai} · {currentSession?.timeDubai} ·{' '}
                  {mode === 'in_person' ? 'BurJuman Studio' : 'Online Stream'}
                </p>
              </div>
              <div className="text-right shrink-0 flex flex-col gap-1">
                <span className="text-lg font-semibold leading-tight tabular-nums text-ink">{currentPlan.price}</span>
                <span className="text-xs uppercase tracking-[0.14em] text-ink-soft">{currentPlan.name}</span>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="booking-name" className={ui.label}>
                  Full Name *
                </label>
                <input
                  id="booking-name"
                  type="text"
                  required
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Layla Al-Mansoor"
                  className={ui.input}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="booking-email" className={ui.label}>
                  Email Address * (For instant confirmation)
                </label>
                <input
                  id="booking-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="layla@example.com"
                  className={ui.input}
                />
              </div>
            </div>

            {planKey === 'free' ? (
              <div className={cn(ui.notice, 'flex items-center gap-3')}>
                <Check size={16} className="text-success shrink-0" aria-hidden="true" />
                <span>
                  Complimentary session · Total: <strong className="font-semibold">AED 0</strong> (No card required)
                </span>
              </div>
            ) : (
              <div className={cn(ui.panel, 'flex flex-col gap-2')}>
                <span className={ui.label}>Payment</span>
                <p className="text-sm leading-[1.5] text-ink-soft">
                  Your seat is held immediately. Settle AED {currentPlan.aed} at BurJuman Residence Block D reception desk upon arrival. Online payment is coming soon.
                </p>
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center gap-3">
              <AnimateIcon animateOnHover asChild>
                <button type="button" onClick={() => setStep(1)} className={ui.secondary}>
                  <ArrowLeft size={14} aria-hidden="true" />
                  Back
                </button>
              </AnimateIcon>

              <button type="button" disabled={loading} onClick={handleNextStep} className={cn(ui.primary, 'w-full sm:w-auto sm:flex-1 px-4')}>
                {loading
                  ? 'Confirming...'
                  : planKey === 'free'
                  ? 'Confirm Free Reservation'
                  : `Reserve Seat (Pay at Studio)`}
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 3: Confirmation ================= */}
        {step === 3 && confirmedBooking && (
          <div className="flex flex-col items-center gap-6 text-center">
            <div className="flex flex-col items-center gap-3">
              <span className="inline-flex items-center justify-center size-12 rounded-full bg-calm-bg text-success">
                <Check size={22} animateOnView animateOnViewOnce aria-hidden="true" />
              </span>
              <h2
                id={titleId}
                ref={confirmedHeadingRef}
                tabIndex={-1}
                className="font-display font-normal text-[34px] sm:text-[40px] leading-[1.05] text-ink focus:outline-none"
              >
                You&apos;re on the mat.
              </h2>
              <p className="text-sm leading-[1.5] text-ink-soft max-w-[46ch]">
                {studentEmail ? (
                  <>
                    Confirmation sent to <strong className="font-semibold text-ink">{confirmedBooking.customerEmail}</strong>
                  </>
                ) : (
                  <>We couldn&apos;t send your confirmation email just now. Please save your booking reference below.</>
                )}
              </p>
            </div>

            <div data-testid="booking-reference-card" className="w-full max-w-sm p-5 rounded-[16px] bg-surface-alt flex flex-col items-center gap-1">
              <span className={ui.eyebrow}>Your Booking Reference</span>
              <div className="flex items-center justify-center gap-2 max-w-full">
                <span
                  data-testid="booking-token"
                  className="text-base sm:text-xl font-semibold tabular-nums tracking-[0.04em] whitespace-nowrap text-ink"
                >
                  {confirmedBooking.bookingToken}
                </span>
                <AnimateIcon animateOnHover asChild>
                  <button
                    type="button"
                    onClick={copyToken}
                    aria-label="Copy booking reference"
                    title="Copy booking reference"
                    className="inline-flex items-center justify-center size-11 shrink-0 rounded-full border border-line text-ink hover:border-ink transition-colors duration-200"
                  >
                    <Copy size={16} aria-hidden="true" />
                  </button>
                </AnimateIcon>
              </div>
              <span aria-live="polite" className="text-xs text-ink-soft min-h-4">
                {copied ? 'Copied to clipboard' : ''}
              </span>
            </div>

            <dl className="w-full max-w-md flex flex-col gap-2 text-sm text-left">
              {(
                [
                  ['Class', confirmedBooking.sessionTitle, ''],
                  ['Date & Time', confirmedBooking.sessionTimeDubai, ''],
                  [
                    'Location',
                    confirmedBooking.mode === 'in_person' ? 'BurJuman Residence Block D' : 'Online Stream',
                    '',
                  ],
                  [
                    'Status',
                    confirmedBooking.amountAed
                      ? `AED ${confirmedBooking.amountAed} (${
                          confirmedBooking.paymentStatus === 'paid'
                            ? 'Paid'
                            : confirmedBooking.paymentStatus === 'pending_at_studio'
                              ? 'Pay at Studio'
                              : 'Payment pending'
                        })`
                      : 'Complimentary',
                    !confirmedBooking.amountAed || confirmedBooking.paymentStatus === 'paid' ? 'text-success' : 'text-ink',
                  ],
                ] as const
              ).map(([term, value, tone]) => (
                <div key={term} className="flex justify-between gap-4 py-2 border-b border-line last:border-b-0">
                  <dt className="text-ink-soft">{term}</dt>
                  <dd className={cn('font-medium text-right', tone || 'text-ink')}>{value}</dd>
                </div>
              ))}
            </dl>

            <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
              <a href={getGoogleCalendarUrl()} target="_blank" rel="noopener noreferrer" className={ui.secondary}>
                <Calendar className="size-4 text-accent-text" aria-hidden="true" />
                Add to Calendar
              </a>
              <button type="button" onClick={() => setShowEmailDetails(!showEmailDetails)} className={ui.secondary}>
                <Mail className="size-4 text-accent-text" aria-hidden="true" />
                {showEmailDetails ? 'Hide Email' : 'View Email Copy'}
              </button>
            </div>

            {showEmailDetails && (
              <div className={cn(ui.panel, 'w-full max-w-md text-left flex flex-col gap-3')}>
                <div className="text-xs text-ink-soft pb-3 border-b border-line flex flex-col gap-1">
                  <p>
                    <strong className="font-semibold text-ink">From:</strong> {studentEmail?.sender || 'Priyanshi · YogaPriyanshi'}
                  </p>
                  <p>
                    <strong className="font-semibold text-ink">To:</strong> {confirmedBooking.customerEmail}
                  </p>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-[1.6] text-ink-soft">
                  {studentEmail?.body ||
                    `Your booking is confirmed, but we couldn't send the confirmation email just now.\n\nPlease keep your booking token: ${confirmedBooking.bookingToken}\n\nYou'll need it to manage or cancel this booking.`}
                </p>
              </div>
            )}

            <button type="button" onClick={onClose} className={ui.primary}>
              Return to Studio
            </button>
          </div>
        )}
      </div>
    </ModalSheet>
  );
};
