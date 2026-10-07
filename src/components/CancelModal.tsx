import React, { useState } from 'react';
import { api } from '../services/api';
import { X, Search, AlertCircle, CheckCircle2, Calendar, Clock, MapPin, User, ArrowLeft } from 'lucide-react';
import { Booking, ClassSession } from '../types';

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

  if (!isOpen) return null;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0f0e0b]/80 backdrop-blur-xs">
      <div className="bg-[#faf8f3] text-[#0f0e0b] border border-[#0f0e0b]/15 max-w-lg w-full p-6 sm:p-8 shadow-2xl relative max-h-[92vh] overflow-y-auto rounded-xs">
        <button
          type="button"
          onClick={() => {
            handleReset();
            onClose();
          }}
          className="absolute top-6 right-6 text-[#0f0e0b]/50 hover:text-[#0f0e0b]"
        >
          <X className="w-5 h-5" />
        </button>

        <span className="text-[11px] uppercase tracking-widest text-[#c4b48a] font-semibold block mb-2">
          BurJuman Residence Block D, Dubai
        </span>

        <h3 className="font-serif text-2xl sm:text-3xl text-[#0f0e0b] mb-2">
          Manage Reservation
        </h3>
        <p className="text-xs text-[#0f0e0b]/60 mb-6">
          Look up booking details or cancel according to the studio 6-hour policy.
        </p>

        {error && (
          <div className="p-3.5 mb-5 bg-red-50 border border-red-200 text-xs text-red-900 flex items-start gap-2 rounded-xs">
            <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* STATE 1: Cancelled successfully */}
        {resultMessage && cancelledBooking ? (
          <div className="py-2 text-center">
            <CheckCircle2 className="w-10 h-10 text-[#c4b48a] mx-auto mb-3" />
            <h4 className="font-serif text-2xl text-[#0f0e0b] mb-2">Reservation Cancelled</h4>
            <div className="bg-[#f2ede4] border border-[#0f0e0b]/10 p-4 text-left text-xs space-y-2 mb-4 rounded-xs">
              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/60">Booking Token:</span>
                <span className="font-mono font-bold">{cancelledBooking.bookingToken}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/60">Class:</span>
                <span className="font-semibold">{cancelledBooking.sessionTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/60">Credit Policy:</span>
                <span
                  className={`font-semibold uppercase tracking-wider ${
                    cancelledBooking.creditStatus === 'refunded' ? 'text-emerald-700' : 'text-amber-800'
                  }`}
                >
                  {cancelledBooking.creditStatus === 'refunded' ? 'Refunded' : 'Burned (Late Notice)'}
                </span>
              </div>
            </div>
            <p className="text-xs text-[#0f0e0b]/75 leading-relaxed mb-6">{resultMessage}</p>
            <button
              type="button"
              onClick={() => {
                handleReset();
                onClose();
              }}
              className="w-full py-3.5 bg-[#0f0e0b] text-[#faf8f3] text-xs font-semibold uppercase tracking-widest rounded-xs"
            >
              Done & Return to Studio
            </button>
          </div>
        ) : lookedUpBooking ? (
          /* STATE 2: Looked up booking details card */
          <div className="space-y-4">
            <div className="bg-[#f2ede4] border border-[#0f0e0b]/15 p-4 rounded-xs text-xs space-y-2.5">
              <div className="flex justify-between items-center border-b border-[#0f0e0b]/10 pb-2">
                <span className="text-[#0f0e0b]/60 uppercase tracking-wider">Status</span>
                <span
                  className={`font-semibold uppercase tracking-wider px-2 py-0.5 rounded-xs text-[10px] ${
                    lookedUpBooking.status === 'confirmed'
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                      : 'bg-red-100 text-red-900 border border-red-300'
                  }`}
                >
                  {lookedUpBooking.status}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/60 uppercase tracking-wider">Student</span>
                <span className="font-semibold text-[#0f0e0b]">{lookedUpBooking.customerName}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/60 uppercase tracking-wider">Email</span>
                <span className="font-mono text-[#0f0e0b]">{lookedUpBooking.customerEmail}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/60 uppercase tracking-wider">Class</span>
                <span className="font-semibold text-[#0f0e0b]">{lookedUpBooking.sessionTitle}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/60 uppercase tracking-wider">Time</span>
                <span className="font-semibold text-[#0f0e0b]">{lookedUpBooking.sessionTimeDubai}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-[#0f0e0b]/60 uppercase tracking-wider">Format</span>
                <span className="text-[#0f0e0b]">
                  {lookedUpBooking.mode === 'in_person'
                    ? 'In-Person (BurJuman Residence Block D)'
                    : 'Online Stream'}
                </span>
              </div>

              <div className="flex justify-between border-t border-[#0f0e0b]/10 pt-2">
                <span className="text-[#0f0e0b]/60 uppercase tracking-wider">Token</span>
                <span className="font-mono font-bold text-sm text-[#0f0e0b]">{lookedUpBooking.bookingToken}</span>
              </div>
            </div>

            {/* Policy evaluation */}
            {lookedUpBooking.status === 'confirmed' ? (
              <div
                className={`p-3.5 border rounded-xs text-xs leading-relaxed ${
                  isFreeCancel
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                    : 'bg-amber-50 border-amber-300 text-amber-950'
                }`}
              >
                <p className="font-semibold mb-1">
                  {isFreeCancel ? 'Eligible for Free Cancellation' : 'Late Cancellation Notice'}
                </p>
                <p>
                  {isFreeCancel
                    ? `You are cancelling ${noticeHours?.toFixed(1)} hours before class (≥ 6h). Your seat will be released and your class credit will be refunded.`
                    : `You are cancelling less than 6 hours before class (${noticeHours?.toFixed(1)}h remaining). Your seat will be released, but your class credit is burned per studio policy.`}
                </p>
              </div>
            ) : (
              <div className="p-3.5 bg-zinc-100 border border-zinc-300 text-xs text-zinc-800 rounded-xs">
                This reservation has already been cancelled. No further action needed.
              </div>
            )}

            {/* Action buttons */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleReset}
                className="px-4 py-3 border border-[#0f0e0b]/20 text-xs font-semibold uppercase tracking-widest text-[#0f0e0b] flex items-center gap-1.5 rounded-xs"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Look Up Another
              </button>

              {lookedUpBooking.status === 'confirmed' && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleCancelSubmit}
                  className="px-6 py-3 bg-red-700 hover:bg-red-800 text-white text-xs font-semibold uppercase tracking-widest transition-colors rounded-xs shadow-xs"
                >
                  {loading ? 'Processing...' : 'Confirm Cancellation'}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* STATE 3: Token Input Form */
          <form onSubmit={handleLookup} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-2">
                Booking Reference Token
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  placeholder="e.g. YP-8K2N9F"
                  className="w-full px-4 py-3.5 bg-[#faf8f3] border border-[#0f0e0b]/25 font-mono text-sm uppercase focus:outline-hidden focus:border-[#0f0e0b] rounded-xs"
                />
              </div>
              <p className="text-[11px] text-[#0f0e0b]/50 mt-1.5">
                Paste the 6-character token from your booking confirmation screen or email.
              </p>
            </div>

            <div className="bg-[#f2ede4] border border-[#0f0e0b]/10 p-3.5 rounded-xs text-xs text-[#0f0e0b]/70 space-y-1">
              <p className="font-semibold text-[#0f0e0b]">Cancellation Policy:</p>
              <p>• <strong>Free up to 6 hours</strong> before start: Releases seat & refunds credit.</p>
              <p>• <strong>Late (&lt; 6 hours)</strong>: Releases seat to waitlist, credit is burned.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#0f0e0b] hover:bg-[#262420] text-[#faf8f3] text-xs font-semibold uppercase tracking-widest transition-colors flex items-center justify-center gap-2 rounded-xs shadow-xs"
            >
              <Search className="w-3.5 h-3.5 text-[#c4b48a]" />
              {loading ? 'Searching...' : 'Find My Reservation'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
