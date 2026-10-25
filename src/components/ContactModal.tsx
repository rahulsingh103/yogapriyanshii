import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { Check } from '@/components/animate-ui/icons/check';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { WHATSAPP_ENABLED, whatsappUrl } from '@/constants/contact';
import { MEMBERSHIP, MEMBERSHIP_FORM, membershipPrefill, type MembershipFormat } from '../constants/membership';
import { api } from '../services/api';
import { ModalSheet } from './ModalSheet';
import { WhatsAppGlyph } from './WhatsAppGlyph';

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
  ['Vinyasa Yoga', 'Vinyasa Yoga'],
  ['Ashtanga Yoga', 'Ashtanga Yoga'],
  ['Private Aerial Yoga', 'Private Aerial Yoga'],
  ['Private session', 'Private 1-to-1 session'],
  [MEMBERSHIP.interest, 'Monthly membership'],
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
  // Membership mode follows the selected interest ("Join the membership" presets it).
  const [format, setFormat] = useState<MembershipFormat | null>(null);
  const isMembership = interest === MEMBERSHIP.interest;

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  /** What was sent, captured only after the server accepted it: the success view and its WhatsApp prefill use it. */
  const [sent, setSent] = useState<{ membership: boolean; name: string } | null>(null);
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

  // Leaving membership mode drops the format choice, and the message is required again.
  useEffect(() => {
    if (!isMembership) setFormat(null);
    else setFieldErrors((prev) => (prev.message ? { ...prev, message: undefined } : prev));
  }, [isMembership]);

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
    if (!isMembership && !message.trim()) found.message = 'Please write a short message.';
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
        ...(isMembership && format ? { format } : {}),
      });
      setSent({ membership: isMembership, name: name.trim() });
      setSubmitted(true);
      setName('');
      setEmail('');
      setPhone('');
      setMessage('');
      setFormat(null);
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
    <ModalSheet isOpen={isOpen} onClose={onClose} labelledBy={titleId} closeLabel="Close contact form" dismissible={!loading}>
      {submitted && sent?.membership ? (
        <div className="flex flex-col items-center gap-6 py-4 text-center">
          <span className="inline-flex items-center justify-center size-12 rounded-full bg-calm-bg text-success">
            <Check size={22} animateOnView animateOnViewOnce aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-2">
            <h2
              id={titleId}
              ref={sentHeadingRef}
              tabIndex={-1}
              className="font-display font-normal text-title sm:text-title-lg text-ink focus:outline-none"
            >
              {MEMBERSHIP_FORM.sentTitle}
            </h2>
            <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">{MEMBERSHIP_FORM.sentBody}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
            {WHATSAPP_ENABLED && (
              <a
                href={whatsappUrl(membershipPrefill(sent.name))}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(ui.primary, 'w-full sm:w-auto')}
              >
                <WhatsAppGlyph size={16} />
                Continue on WhatsApp
              </a>
            )}
            <button type="button" onClick={onClose} className={cn(ui.secondary, 'w-full sm:w-auto')}>
              Close
            </button>
          </div>
        </div>
      ) : submitted ? (
        <div className="flex flex-col items-center gap-6 py-4 text-center">
          <span className="inline-flex items-center justify-center size-12 rounded-full bg-calm-bg text-success">
            <Check size={22} animateOnView animateOnViewOnce aria-hidden="true" />
          </span>
          <div className="flex flex-col gap-2">
            <h2
              id={titleId}
              ref={sentHeadingRef}
              tabIndex={-1}
              className="font-display font-normal text-title sm:text-title-lg text-ink focus:outline-none"
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
              {isMembership ? MEMBERSHIP_FORM.title : 'Send a message'}
            </h2>
            <p className="text-sm leading-[1.5] text-ink-soft">
              {isMembership ? MEMBERSHIP_FORM.intro : 'Priyanshi reads every message and replies within a day.'}
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

          {isMembership && (
            <div className="flex flex-col gap-3">
              <span id="contact-format-label" className={ui.label}>
                {MEMBERSHIP_FORM.formatLabel}
              </span>
              <div
                role="group"
                aria-labelledby="contact-format-label"
                className="grid grid-cols-2 gap-1 p-1 bg-surface-alt rounded-full"
              >
                {MEMBERSHIP_FORM.formats.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={format === value}
                    // Tapping the chosen one again clears it: the format is optional.
                    onClick={() => setFormat((prev) => (prev === value ? null : value))}
                    className={cn(
                      'press-soft min-h-11 px-3 rounded-full text-sm font-medium transition duration-200 ease-spring active:duration-100',
                      format === value ? 'bg-ink text-on-ink' : 'text-ink-soft hover:text-ink'
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="contact-message" className={ui.label}>
              {isMembership ? MEMBERSHIP_FORM.timesLabel : 'Your Message *'}
            </label>
            <textarea
              id="contact-message"
              required={!isMembership}
              rows={4}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                clearFieldError('message');
              }}
              placeholder={
                isMembership
                  ? MEMBERSHIP_FORM.timesPlaceholder
                  : 'Tell Priyanshi about your experience level, goals, or scheduling preferences...'
              }
              className={cn(ui.textarea, 'resize-y min-h-[120px]')}
              {...fieldA11y('message')}
            />
            {fieldError('message')}
          </div>

          <AnimateIcon animateOnHover asChild>
            <button type="submit" disabled={loading} className={cn(ui.primary, 'w-full')}>
              {loading ? (
                isMembership ? MEMBERSHIP_FORM.sending : 'Sending Message...'
              ) : (
                <>
                  <span>{isMembership ? MEMBERSHIP_FORM.submit : 'Send Message'}</span>
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
