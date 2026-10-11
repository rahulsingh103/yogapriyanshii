import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { Check } from '@/components/animate-ui/icons/check';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { api } from '../services/api';
import { ModalSheet } from './ModalSheet';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Preset "Area of Interest", e.g. from a not-yet-scheduled class card. */
  initialInterest?: string | null;
}

/** [value sent to the server, label shown]. Values must match CONTACT_INTERESTS in backend/validate.ts. */
const INTERESTS: ReadonlyArray<readonly [string, string]> = [
  ['General enquiry', 'General enquiry'],
  ['Hatha Yoga', 'Hatha Yoga'],
  ['Barre Yoga', 'Barre Yoga'],
  ['Wheel Yoga', 'Wheel Yoga (Signature)'],
  ['Chakra Yoga Flow', 'Chakra Yoga Flow'],
  ['Spine Healing', 'Spine Healing'],
  ['Mobility Yoga', 'Mobility Yoga'],
  ['Yin Yoga', 'Yin Yoga'],
  ['Prenatal & Postnatal', 'Prenatal & Postnatal'],
  ['Private session', 'Private 1-to-1 session'],
  ['Class Packs & Corporate', 'Class Packs & Corporate'],
];

const DEFAULT_INTEREST = 'General enquiry';

type Field = 'name' | 'email' | 'phone' | 'message';
type FieldErrors = Partial<Record<Field, string>>;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose, initialInterest }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [interest, setInterest] = useState(DEFAULT_INTEREST);
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Hidden anti-bot trap

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const sentHeadingRef = useRef<HTMLHeadingElement>(null);

  // Each opening starts a fresh message with the preset interest (or the default).
  // Typed text survives a close and reopen; only the sent state and old errors are cleared.
  useEffect(() => {
    if (!isOpen) return;
    const preset = INTERESTS.some(([value]) => value === initialInterest) ? initialInterest! : DEFAULT_INTEREST;
    setInterest(preset);
    setSubmitted(false);
    setError(null);
    setFieldErrors({});
  }, [isOpen, initialInterest]);

  // Screen readers hear the result: focus moves to the "Message Sent" heading.
  useEffect(() => {
    if (submitted) sentHeadingRef.current?.focus();
  }, [submitted]);

  const clearFieldError = (field: Field) =>
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const found: FieldErrors = {};
    if (!name.trim()) found.name = 'Please enter your name.';
    if (!email.trim()) found.email = 'Please enter your email address.';
    else if (!EMAIL_SHAPE.test(email.trim())) found.email = 'Please enter a valid email address.';
    if (!message.trim()) found.message = 'Please write a short message.';
    const firstInvalid = (['name', 'email', 'message'] as const).find((field) => found[field]);
    if (firstInvalid) {
      setFieldErrors(found);
      setError(
        found.name || found.message || !email.trim()
          ? 'Please fill in all required fields.'
          : 'Please check your email address.'
      );
      document.getElementById(`contact-${firstInvalid}`)?.focus();
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setFieldErrors({});
      await api.sendContact({
        name,
        email,
        phone: phone.trim(),
        interest,
        message,
        website: honeypot, // Honeypot field
      });
      setSubmitted(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
    } catch (err: any) {
      const text: string = err?.message || 'Failed to send message. Please try again.';
      setError(text);
      // The server's phone check points at the phone field; its message stays in the summary alert.
      if (/phone/i.test(text)) setFieldErrors({ phone: text });
    } finally {
      setLoading(false);
    }
  };

  const titleId = 'contact-modal-title';
  const summaryId = 'contact-error-summary';

  /** aria wiring for a field: invalid state, and a pointer to its message (or the summary). */
  const fieldA11y = (field: Field) =>
    fieldErrors[field]
      ? {
          'aria-invalid': true as const,
          'aria-describedby': field === 'phone' ? summaryId : `contact-${field}-error`,
        }
      : {};

  const fieldError = (field: Exclude<Field, 'phone'>) =>
    fieldErrors[field] ? (
      <p id={`contact-${field}-error`} className="text-sm leading-[1.5] text-error">
        {fieldErrors[field]}
      </p>
    ) : null;

  return (
    <ModalSheet isOpen={isOpen} onClose={onClose} labelledBy={titleId} closeLabel="Close contact form">
      {submitted ? (
        <div className="flex flex-col items-center gap-6 py-4 text-center">
          <span className="inline-flex items-center justify-center size-12 rounded-full bg-calm-bg text-success">
            <Check size={22} animateOnView animateOnViewOnce aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-2">
            <h2
              id={titleId}
              ref={sentHeadingRef}
              tabIndex={-1}
              className="font-display font-normal text-[34px] sm:text-[40px] leading-[1.05] text-ink focus:outline-none"
            >
              Message Sent
            </h2>
            <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
              Thank you — Priyanshi will be in touch within 24 hours.
            </p>
          </div>
          <button type="button" onClick={() => setSubmitted(false)} className={ui.primary}>
            Send Another Message
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2 id={titleId} className={ui.title}>
              Send a message
            </h2>
            <p className="text-sm leading-[1.5] text-ink-soft">
              Priyanshi reads every message and replies within a day.
            </p>
            <p className="text-sm leading-[1.5] text-ink-soft">* required</p>
          </div>

          {error && (
            <div id={summaryId} role="alert" className={ui.error}>
              {error}
            </div>
          )}

          {/* Honeypot field (hidden from real users, filled by bots) */}
          <div className="hidden" aria-hidden="true">
            <label htmlFor="website-field">Website (do not fill)</label>
            <input
              id="website-field"
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="contact-name" className={ui.label}>
                Full Name *
              </label>
              <input
                id="contact-name"
                type="text"
                required
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  clearFieldError('name');
                }}
                placeholder="e.g. Sarah Jenkins"
                className={ui.input}
                {...fieldA11y('name')}
              />
              {fieldError('name')}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="contact-email" className={ui.label}>
                Email Address *
              </label>
              <input
                id="contact-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  clearFieldError('email');
                }}
                placeholder="sarah@example.com"
                className={ui.input}
                {...fieldA11y('email')}
              />
              {fieldError('email')}
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="contact-phone" className={ui.label}>
                Phone (optional)
              </label>
              <input
                id="contact-phone"
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                maxLength={30}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  clearFieldError('phone');
                }}
                placeholder="+971 50 123 4567"
                className={ui.input}
                {...fieldA11y('phone')}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="contact-interest" className={ui.label}>
                Area of Interest
              </label>
              <div className="relative">
                <select
                  id="contact-interest"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  className={cn(ui.input, 'appearance-none pr-10 cursor-pointer')}
                >
                  {INTERESTS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="size-4 text-ink-soft absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="contact-message" className={ui.label}>
              Your Message *
            </label>
            <textarea
              id="contact-message"
              required
              rows={4}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                clearFieldError('message');
              }}
              placeholder="Tell Priyanshi about your experience level, goals, or scheduling preferences..."
              className={cn(ui.textarea, 'resize-y min-h-[120px]')}
              {...fieldA11y('message')}
            />
            {fieldError('message')}
          </div>

          <AnimateIcon animateOnHover asChild>
            <button type="submit" disabled={loading} className={cn(ui.primary, 'w-full')}>
              {loading ? (
                'Sending Message...'
              ) : (
                <>
                  <span>Send Message</span>
                  <ArrowRight size={16} aria-hidden="true" />
                </>
              )}
            </button>
          </AnimateIcon>
        </form>
      )}
    </ModalSheet>
  );
};
