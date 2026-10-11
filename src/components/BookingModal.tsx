import React, { useState, useEffect, useRef } from 'react';
import { api, ApiError } from '../services/api';
import { ClassSession, Booking, EmailNotification } from '../types';
import {
  X,
  Copy,
  ArrowLeft,
  ArrowRight,
  Calendar,
  CheckCircle2,
  CreditCard,
  Building,
  Mail,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedSession?: ClassSession | null;
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
          if (preselectedSession && preselectedSession.status === 'available') {
            setSelectedSessionId(preselectedSession.id);
          } else if (available.length > 0 && !selectedSessionId) {
            setSelectedSessionId(available[0].id);
          }
        })
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Unable to load the live schedule.');
        });
    }
  }, [isOpen, preselectedSession, initialPlanKey]);

  if (!isOpen) return null;

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
        <a href={`mailto:${address}`} className="underline underline-offset-2 font-medium text-ink hover:text-ink/70">
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#0f0e0b]/75 backdrop-blur-xs">
      <div className="bg-[#faf8f3] text-[#0f0e0b] border border-[#0f0e0b]/15 max-w-xl w-full p-5 sm:p-8 md:p-9 shadow-2xl relative max-h-[92vh] overflow-y-auto rounded-sm">
        {/* Close Button with 44px touch hitbox */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 sm:top-5 sm:right-5 min-w-[44px] min-h-[44px] flex items-center justify-center text-[#0f0e0b]/50 hover:text-[#0f0e0b] transition-colors rounded-xs"
          aria-label="Close modal"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Step Indicator & Header (One Big, One Small) */}
        {!confirmedBooking && (
          <div className="mb-7">
            <div className="flex items-center gap-3 text-xs uppercase tracking-widest text-[#0f0e0b]/40 mb-2">
              <span className="font-semibold text-[#c4b48a]">Step {step} of 2</span>
              <span>·</span>
              <span>{step === 1 ? 'Package & Slot' : 'Student & Checkout'}</span>
            </div>
            <h3 className="font-serif text-3xl sm:text-4xl text-[#0f0e0b] tracking-tight">
              {step === 1 ? 'Select practice' : 'Your details'}
            </h3>
            <p className="text-xs text-[#0f0e0b]/60 mt-1">
              BurJuman Residence Block D · Dubai
            </p>
          </div>
        )}

        {/* Error banner */}
        {error && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className={`p-3.5 mb-5 border text-xs leading-relaxed rounded-xs outline-hidden focus:ring-2 focus:ring-ink/50 focus:ring-offset-2 focus:ring-offset-cream ${
              errorTone === 'notice'
                ? 'bg-parchment border-ink/15 text-ink'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {errorTone === 'notice' ? renderMessage(error) : error}
          </div>
        )}

        {/* ================= STEP 1: Package & Session ================= */}
        {step === 1 && (
          <div className="space-y-6">
            {/* 1. SELECT PACKAGE: Clean horizontal cards with Big Price & Small Label */}
            <div>
              <div className="flex justify-between items-baseline mb-2.5">
                <span className="text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold">
                  Package
                </span>
                <span className="text-[11px] text-[#0f0e0b]/50">
                  {currentPlan.aed === 0 ? 'Complimentary introductory class' : 'Flexible studio credits'}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {PLANS.map((p) => {
                  const isSelected = planKey === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => setPlanKey(p.key as any)}
                      className={`p-3 text-left border transition-all flex flex-col justify-between rounded-xs ${
                        isSelected
                          ? 'border-[#0f0e0b] bg-[#0f0e0b] text-[#faf8f3] shadow-xs'
                          : 'border-[#0f0e0b]/15 bg-white/60 hover:border-[#0f0e0b]/40 text-[#0f0e0b]'
                      }`}
                    >
                      <span className={`text-[10px] uppercase font-semibold tracking-wider ${
                        isSelected ? 'text-[#c4b48a]' : 'text-[#0f0e0b]/50'
                      }`}>
                        {p.tag}
                      </span>
                      {/* ONE THING BIG */}
                      <span className="font-serif text-lg font-semibold my-0.5 leading-tight">
                        {p.price}
                      </span>
                      {/* ONE THING SMALL */}
                      <span className={`text-[11px] truncate ${
                        isSelected ? 'text-[#faf8f3]/70' : 'text-[#0f0e0b]/60'
                      }`}>
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. ATTENDANCE FORMAT: Sleek Segmented Switcher */}
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-2">
                Format
              </label>
              <div className="grid grid-cols-2 gap-2 bg-[#f2ede4] p-1 border border-[#0f0e0b]/10 rounded-xs">
                <button
                  type="button"
                  onClick={() => setMode('in_person')}
                  className={`py-2 text-xs font-semibold uppercase tracking-wider transition-all rounded-xs ${
                    mode === 'in_person'
                      ? 'bg-[#0f0e0b] text-[#faf8f3] shadow-xs'
                      : 'text-[#0f0e0b]/70 hover:text-[#0f0e0b]'
                  }`}
                >
                  In-Person (BurJuman)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('online')}
                  className={`py-2 text-xs font-semibold uppercase tracking-wider transition-all rounded-xs ${
                    mode === 'online'
                      ? 'bg-[#0f0e0b] text-[#faf8f3] shadow-xs'
                      : 'text-[#0f0e0b]/70 hover:text-[#0f0e0b]'
                  }`}
                >
                  Online Live Stream
                </button>
              </div>
            </div>

            {/* 3. CLASS SLOT PICKER: High contrast, readable, non-redundant */}
            <div>
              <div className="flex justify-between items-baseline mb-2">
                <label className="text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold">
                  Class & Time
                </label>
                <span className="text-[11px] text-[#0f0e0b]/50">
                  Asia/Dubai (GMT+4)
                </span>
              </div>
              {noOtherSessions ? (
                <p className="px-4 py-3 bg-parchment border border-ink/15 text-sm text-ink/70 rounded-xs">
                  No other open sessions right now — please contact the studio.
                </p>
              ) : (
              <div className="relative">
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="w-full appearance-none px-4 py-3 bg-white border border-[#0f0e0b]/20 text-base sm:text-sm focus:outline-hidden focus:border-[#0f0e0b] rounded-xs cursor-pointer font-medium pr-10 min-h-[44px]"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.className} — {s.dateDubai} at {s.timeDubai} ({s.spotsLeft} spots)
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-[#0f0e0b]/50 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
              )}
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleNextStep}
                disabled={noOtherSessions}
                className="w-full py-3.5 min-h-[48px] bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-xs font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 rounded-xs shadow-xs disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#c4b48a]"
              >
                <span>Continue to Checkout</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ================= STEP 2: Details & Checkout ================= */}
        {step === 2 && (
          <div className="space-y-5">
            {/* Order Summary Strip (Big Price, Small Metadata) */}
            <div className="p-4 bg-[#f2ede4] border border-[#0f0e0b]/10 rounded-xs flex items-center justify-between">
              <div>
                <p className="font-serif text-lg font-semibold text-[#0f0e0b]">
                  {currentSession?.className}
                </p>
                <p className="text-xs text-[#0f0e0b]/60">
                  {currentSession?.dateDubai} · {currentSession?.timeDubai} · {mode === 'in_person' ? 'BurJuman Studio' : 'Online Stream'}
                </p>
              </div>
              <div className="text-right">
                {/* ONE THING BIG */}
                <span className="font-serif text-2xl font-bold text-[#0f0e0b] block leading-tight">
                  {currentPlan.price}
                </span>
                {/* ONE THING SMALL */}
                <span className="text-[10px] uppercase tracking-wider text-[#0f0e0b]/50">
                  {currentPlan.name}
                </span>
              </div>
            </div>

            {/* Inputs with text-base to prevent mobile iOS zoom */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Layla Al-Mansoor"
                  className="w-full px-3.5 py-3 sm:py-2.5 bg-white border border-[#0f0e0b]/20 text-base sm:text-sm focus:outline-hidden focus:border-[#0f0e0b] rounded-xs min-h-[44px]"
                />
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-1">
                  Email Address * (For instant confirmation)
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="layla@example.com"
                  className="w-full px-3.5 py-3 sm:py-2.5 bg-white border border-[#0f0e0b]/20 text-base sm:text-sm focus:outline-hidden focus:border-[#0f0e0b] rounded-xs min-h-[44px]"
                />
              </div>
            </div>

            {/* Payment Section (Clean & Minimal) */}
            {planKey === 'free' ? (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 rounded-xs flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>Complimentary session · Total: <strong>AED 0</strong> (No card required)</span>
              </div>
            ) : (
              <div className="border border-[#0f0e0b]/15 p-4 rounded-xs bg-[#f2ede4]/40 space-y-3">
                <span className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold">
                  Payment
                </span>
                <p className="text-xs text-[#0f0e0b]/70">
                  Your seat is held immediately. Settle AED {currentPlan.aed} at BurJuman Residence Block D reception desk upon arrival. Online payment is coming soon.
                </p>
              </div>
            )}

            {/* Stepper Buttons with 48px touch targets */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-3 min-h-[48px] border border-[#0f0e0b]/20 text-xs font-semibold uppercase tracking-widest text-[#0f0e0b] flex items-center gap-1.5 rounded-xs hover:border-[#0f0e0b]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleNextStep}
                className="flex-1 py-3.5 min-h-[48px] bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-xs font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 rounded-xs shadow-xs"
              >
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
          <div className="py-2 text-center">
            {/* ONE THING BIG: Success Heading & Token */}
            <div className="w-12 h-12 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-6 h-6 text-emerald-700" />
            </div>

            <h3 className="font-serif text-3xl sm:text-4xl text-[#0f0e0b] mb-1">
              You&apos;re on the mat.
            </h3>
            <p className="text-xs text-[#0f0e0b]/60 mb-6">
              {studentEmail ? (
                <>
                  Confirmation sent to <strong>{confirmedBooking.customerEmail}</strong>
                </>
              ) : (
                <>We couldn&apos;t send your confirmation email just now. Please save your booking reference below.</>
              )}
            </p>

            {/* Prominent Booking Token Badge (BIG TOKEN, Small Label) */}
            <div data-testid="booking-reference-card" className="bg-[#f2ede4] border border-[#0f0e0b]/15 p-5 max-w-sm mx-auto mb-6 rounded-xs">
              <span className="text-xs uppercase tracking-widest text-[#0f0e0b]/60 block mb-1">
                Your Booking Reference
              </span>
              <div className="flex items-center justify-center gap-2">
                <span
                  data-testid="booking-token"
                  className="font-mono text-2xl max-sm:text-base max-sm:tracking-normal whitespace-nowrap font-bold tracking-wider text-[#0f0e0b]"
                >
                  {confirmedBooking.bookingToken}
                </span>
                <button
                  type="button"
                  onClick={copyToken}
                  aria-label="Copy booking reference"
                  title="Copy booking reference"
                  className="min-w-[44px] min-h-[44px] shrink-0 flex items-center justify-center text-[#0f0e0b]/60 hover:text-[#0f0e0b] transition-colors rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ink/50"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <span aria-live="polite" className="text-xs text-ink/70 font-medium block mt-1 min-h-[1rem]">
                {copied ? 'Copied to clipboard' : ''}
              </span>
            </div>

            {/* Clean Metadata List */}
            <div className="bg-white border border-[#0f0e0b]/10 p-4 max-w-md mx-auto text-xs space-y-2 mb-6 rounded-xs text-left">
              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/50">Class</span>
                <span className="font-medium text-[#0f0e0b]">{confirmedBooking.sessionTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/50">Date & Time</span>
                <span className="font-medium text-[#0f0e0b]">{confirmedBooking.sessionTimeDubai}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/50">Location</span>
                <span className="font-medium text-[#0f0e0b]">
                  {confirmedBooking.mode === 'in_person' ? 'BurJuman Residence Block D' : 'Online Stream'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/50">Status</span>
                <span
                  className={`font-medium ${
                    !confirmedBooking.amountAed || confirmedBooking.paymentStatus === 'paid'
                      ? 'text-emerald-800'
                      : 'text-ink/70'
                  }`}
                >
                  {confirmedBooking.amountAed
                    ? `AED ${confirmedBooking.amountAed} (${
                        confirmedBooking.paymentStatus === 'paid'
                          ? 'Paid'
                          : confirmedBooking.paymentStatus === 'pending_at_studio'
                            ? 'Pay at Studio'
                            : 'Payment pending'
                      })`
                    : 'Complimentary'}
                </span>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <a
                href={getGoogleCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-5 py-2.5 border border-[#0f0e0b]/20 hover:border-[#0f0e0b] text-xs font-semibold uppercase tracking-wider text-[#0f0e0b] transition-colors rounded-xs flex items-center justify-center gap-2"
              >
                <Calendar className="w-3.5 h-3.5 text-[#c4b48a]" />
                Add to Calendar
              </a>
              <button
                type="button"
                onClick={() => setShowEmailDetails(!showEmailDetails)}
                className="w-full sm:w-auto px-5 py-2.5 border border-[#0f0e0b]/20 hover:border-[#0f0e0b] text-xs font-semibold uppercase tracking-wider text-[#0f0e0b] transition-colors rounded-xs flex items-center justify-center gap-2"
              >
                <Mail className="w-3.5 h-3.5 text-[#c4b48a]" />
                {showEmailDetails ? 'Hide Email' : 'View Email Copy'}
              </button>
            </div>

            {/* Collapsible Email Dispatch Preview */}
            {showEmailDetails && (
              <div className="bg-[#171512] text-[#faf8f3] p-4 text-xs leading-relaxed max-w-md mx-auto mb-6 text-left rounded-xs">
                <div className="text-[11px] text-[#faf8f3]/50 pb-2 mb-2 border-b border-[#faf8f3]/10">
                  <p><strong>From:</strong> {studentEmail?.sender || 'Priyanshi · YogaPriyanshi'}</p>
                  <p><strong>To:</strong> {confirmedBooking.customerEmail}</p>
                </div>
                <p className="whitespace-pre-wrap text-[#faf8f3]/90 font-sans">
                  {studentEmail?.body ||
                    `Your booking is confirmed, but we couldn't send the confirmation email just now.\n\nPlease keep your booking token: ${confirmedBooking.bookingToken}\n\nYou'll need it to manage or cancel this booking.`}
                </p>
              </div>
            )}

            <div>
              <button
                type="button"
                onClick={onClose}
                className="px-8 py-3.5 bg-[#0f0e0b] hover:bg-[#262420] text-[#faf8f3] text-xs font-semibold uppercase tracking-widest rounded-xs"
              >
                Return to Studio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
