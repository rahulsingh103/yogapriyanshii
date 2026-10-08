import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
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
  const [paymentMethod, setPaymentMethod] = useState<'card' | 'studio' | 'bank_transfer'>('card');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvc, setCardCvc] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [dispatchedEmails, setDispatchedEmails] = useState<EmailNotification[]>([]);
  const [activeEmailTab, setActiveEmailTab] = useState<'student' | 'studio'>('student');
  const [showEmailDetails, setShowEmailDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setConfirmedBooking(null);
      setDispatchedEmails([]);
      setShowEmailDetails(false);
      setStep(1);
      if (initialPlanKey) {
        setPlanKey(initialPlanKey);
      }

      api.getSchedule().then((data) => {
        const available = data.filter((s) => !s.isRestDay && s.status === 'available');
        setSessions(available);
        if (preselectedSession && preselectedSession.status === 'available') {
          setSelectedSessionId(preselectedSession.id);
        } else if (available.length > 0 && !selectedSessionId) {
          setSelectedSessionId(available[0].id);
        }
      });
    }
  }, [isOpen, preselectedSession, initialPlanKey]);

  if (!isOpen) return null;

  const currentPlan = PLANS.find((p) => p.key === planKey) || PLANS[0];
  const currentSession = sessions.find((s) => s.id === selectedSessionId) || preselectedSession;

  const fillTestCard = () => {
    setCardNumber('4242 •••• •••• 4242');
    setCardExpiry('12/28');
    setCardCvc('888');
    setError(null);
  };

  const handleNextStep = () => {
    setError(null);
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
      if (planKey !== 'free' && paymentMethod === 'card' && !cardNumber.trim()) {
        setError('Please enter your card number or click "Use Test Card".');
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
          <div className="p-3.5 mb-5 bg-red-50 border border-red-200 text-xs text-red-900 leading-relaxed rounded-xs">
            {error}
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
            </div>

            {/* Primary Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleNextStep}
                className="w-full py-3.5 min-h-[48px] bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-xs font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 rounded-xs shadow-xs"
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
                <div className="flex justify-between items-center">
                  <span className="text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold">
                    Payment Option
                  </span>
                  {paymentMethod === 'card' && (
                    <button
                      type="button"
                      onClick={fillTestCard}
                      className="text-[11px] text-[#c4b48a] hover:underline font-medium min-h-[36px] flex items-center"
                    >
                      Use Test Card
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('card')}
                    className={`py-2 px-2 min-h-[44px] flex items-center justify-center border text-center rounded-xs transition-colors font-medium ${
                      paymentMethod === 'card'
                        ? 'bg-[#0f0e0b] text-[#faf8f3] border-[#0f0e0b]'
                        : 'bg-white text-[#0f0e0b] border-[#0f0e0b]/15'
                    }`}
                  >
                    Card
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('studio')}
                    className={`py-2 px-2 min-h-[44px] flex items-center justify-center border text-center rounded-xs transition-colors font-medium ${
                      paymentMethod === 'studio'
                        ? 'bg-[#0f0e0b] text-[#faf8f3] border-[#0f0e0b]'
                        : 'bg-white text-[#0f0e0b] border-[#0f0e0b]/15'
                    }`}
                  >
                    Pay at Studio
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank_transfer')}
                    className={`py-2 px-2 min-h-[44px] flex items-center justify-center border text-center rounded-xs transition-colors font-medium ${
                      paymentMethod === 'bank_transfer'
                        ? 'bg-[#0f0e0b] text-[#faf8f3] border-[#0f0e0b]'
                        : 'bg-white text-[#0f0e0b] border-[#0f0e0b]/15'
                    }`}
                  >
                    Bank Transfer
                  </button>
                </div>

                {paymentMethod === 'card' && (
                  <div className="space-y-2.5 pt-1">
                    <input
                      type="text"
                      value={cardNumber}
                      onChange={(e) => setCardNumber(e.target.value)}
                      placeholder="Card number"
                      className="w-full px-3 py-2.5 bg-white border border-[#0f0e0b]/20 text-base sm:text-xs font-mono rounded-xs focus:outline-hidden min-h-[44px]"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={cardExpiry}
                        onChange={(e) => setCardExpiry(e.target.value)}
                        placeholder="MM / YY"
                        className="w-full px-3 py-2.5 bg-white border border-[#0f0e0b]/20 text-base sm:text-xs font-mono rounded-xs focus:outline-hidden min-h-[44px]"
                      />
                      <input
                        type="text"
                        value={cardCvc}
                        onChange={(e) => setCardCvc(e.target.value)}
                        placeholder="CVC"
                        className="w-full px-3 py-2.5 bg-white border border-[#0f0e0b]/20 text-base sm:text-xs font-mono rounded-xs focus:outline-hidden min-h-[44px]"
                      />
                    </div>
                  </div>
                )}

                {paymentMethod === 'studio' && (
                  <p className="text-xs text-[#0f0e0b]/70 pt-1">
                    Your seat is held immediately. Settle AED {currentPlan.aed} at BurJuman Residence Block D reception desk upon arrival.
                  </p>
                )}

                {paymentMethod === 'bank_transfer' && (
                  <div className="text-xs text-[#0f0e0b]/70 pt-1 space-y-1">
                    <p className="font-mono text-[11px] bg-white p-2 border border-[#0f0e0b]/10 rounded-xs">
                      Emirates NBD · YogaPriyanshi LLC<br />
                      IBAN: AE07 0260 0012 3456 7890 123
                    </p>
                  </div>
                )}
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
                  : paymentMethod === 'studio'
                  ? `Reserve Seat (Pay at Studio)`
                  : `Pay ${currentPlan.price} & Confirm`}
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
              Confirmation dispatched to <strong>{confirmedBooking.customerEmail}</strong>
            </p>

            {/* Prominent Booking Token Badge (BIG TOKEN, Small Label) */}
            <div className="bg-[#f2ede4] border border-[#0f0e0b]/15 p-5 max-w-sm mx-auto mb-6 rounded-xs">
              <span className="text-[10px] uppercase tracking-widest text-[#0f0e0b]/50 block mb-1">
                Your Booking Reference
              </span>
              <div className="flex items-center justify-center gap-2">
                <span className="font-mono text-2xl font-bold tracking-wider text-[#0f0e0b]">
                  {confirmedBooking.bookingToken}
                </span>
                <button
                  type="button"
                  onClick={copyToken}
                  className="p-1.5 text-[#0f0e0b]/60 hover:text-[#0f0e0b] transition-colors"
                  title="Copy Token"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              {copied && (
                <span className="text-[11px] text-[#c4b48a] font-medium block mt-1">
                  Copied to clipboard
                </span>
              )}
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
                <span className="font-medium text-emerald-800">
                  {confirmedBooking.amountAed ? `AED ${confirmedBooking.amountAed} (${confirmedBooking.paymentStatus === 'paid' ? 'Paid' : 'Pay at Studio'})` : 'Complimentary'}
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
                  <p><strong>From:</strong> Priyanshi &lt;priyanshi@yogapriyanshi.com&gt;</p>
                  <p><strong>To:</strong> {confirmedBooking.customerEmail}</p>
                </div>
                <p className="whitespace-pre-wrap text-[#faf8f3]/90 font-sans">
                  {studentEmail?.body || `Hi ${confirmedBooking.customerName},\n\nYour session is confirmed for ${confirmedBooking.sessionTitle} on ${confirmedBooking.sessionTimeDubai} at BurJuman Residence Block D, Dubai.\n\nYour token: ${confirmedBooking.bookingToken}\n\nSee you on the mat!`}
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
