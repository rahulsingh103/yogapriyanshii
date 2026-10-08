import React, { useState } from 'react';
import { api } from '../services/api';
import { Mail, Phone, MapPin, Send, CheckCircle2, ExternalLink } from 'lucide-react';

export const ContactSection: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [interest, setInterest] = useState('General enquiry');
  const [message, setMessage] = useState('');
  const [honeypot, setHoneypot] = useState(''); // Hidden anti-bot trap

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await api.sendContact({
        name,
        email,
        interest,
        message,
        website: honeypot, // Honeypot field
      });
      setSubmitted(true);
      setName('');
      setEmail('');
      setMessage('');
    } catch (err: any) {
      setError(err?.message || 'Failed to send message. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contact" className="py-16 sm:py-20 lg:py-24 bg-[#faf8f3] border-b border-[#0f0e0b]/8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16">
          {/* Left Column: Contact details & Stylised Map Card */}
          <div className="lg:col-span-5 flex flex-col justify-between">
            <div>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#c4b48a] font-semibold mb-2.5 sm:mb-3">
                05. Inquiries & Location
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#0f0e0b] tracking-tight leading-[1.15] mb-4 sm:mb-5 [text-wrap:balance]">
                Get in touch
              </h2>
              <p className="text-sm sm:text-base text-[#0f0e0b]/75 leading-[1.7] mb-6 sm:mb-8 [text-wrap:pretty]">
                Whether you have questions about which signature practice suits your body, private corporate workshops, or private 1-to-1 bookings, Priyanshi responds personally.
              </p>

              <div className="space-y-3.5 mb-8 sm:mb-10 text-xs sm:text-sm text-[#0f0e0b]/80">
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 sm:w-5 h-4 sm:h-5 text-[#c4b48a] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-[#0f0e0b]">Studio Location</span>
                    <span>BurJuman Residence Block D, Bur Dubai, Dubai, UAE</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 sm:w-5 h-4 sm:h-5 text-[#c4b48a] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-[#0f0e0b]">Direct Email</span>
                    <a
                      href="mailto:priyanshi@yogapriyanshi.com"
                      className="hover:text-[#c4b48a] transition-colors"
                    >
                      priyanshi@yogapriyanshi.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 sm:w-5 h-4 sm:h-5 text-[#c4b48a] shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-[#0f0e0b]">Studio Phone</span>
                    <span>+971 50 000 0000</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stylised Map Card with Pin */}
            <div className="relative bg-[#f2ede4] border border-[#0f0e0b]/10 p-5 sm:p-6 rounded-xs overflow-hidden">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-[11px] uppercase tracking-wider text-[#0f0e0b]/70 font-semibold">
                  BurJuman Residence Block D
                </span>
                <a
                  href="https://maps.google.com/?q=BurJuman+Residence+Block+D+Dubai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#c4b48a] hover:underline flex items-center gap-1 font-medium min-h-[36px]"
                >
                  <span>Open in Maps</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-[#0f0e0b]/70 mb-3.5 leading-[1.6]">
                Bur Dubai, Dubai · Convenient access via BurJuman Metro Station & Residence visitor parking.
              </p>
              <div className="h-28 bg-[#0f0e0b]/5 border border-[#0f0e0b]/10 relative flex items-center justify-center rounded-xs">
                <div className="w-3 h-3 rounded-full bg-[#c4b48a] animate-ping absolute" />
                <div className="w-4 h-4 rounded-full bg-[#0f0e0b] border-2 border-[#c4b48a] relative z-10" />
                <span className="absolute bottom-2 text-[10px] text-[#0f0e0b]/60 uppercase tracking-widest font-mono">
                  25.2084° N, 55.2719° E
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Send Message Form */}
          <div className="lg:col-span-7 bg-[#f2ede4] border border-[#0f0e0b]/10 p-6 sm:p-10 lg:p-12 rounded-xs shadow-xs">
            {submitted ? (
              <div className="py-12 text-center">
                <CheckCircle2 className="w-12 h-12 text-[#c4b48a] mx-auto mb-4" />
                <h3 className="font-serif text-2xl text-[#0f0e0b] mb-2">
                  Message Sent
                </h3>
                <p className="text-base text-[#0f0e0b]/75 max-w-md mx-auto mb-8">
                  Thank you — Priyanshi will be in touch within 24 hours.
                </p>
                <button
                  type="button"
                  onClick={() => setSubmitted(false)}
                  className="px-6 py-3 bg-[#0f0e0b] text-[#faf8f3] text-xs font-semibold uppercase tracking-widest"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <h3 className="font-serif text-2xl sm:text-3xl text-[#0f0e0b] mb-2">
                    Send a message
                  </h3>
                  <p className="text-xs text-[#0f0e0b]/60">
                    All inquiries are delivered directly to Priyanshi&apos;s inbox.
                  </p>
                </div>

                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 text-xs text-red-800">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-2">
                      Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className="w-full px-4 py-3 bg-[#faf8f3] border border-[#0f0e0b]/15 text-base sm:text-sm focus:outline-hidden focus:border-[#0f0e0b] rounded-xs min-h-[44px]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-2">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="sarah@example.com"
                      className="w-full px-4 py-3 bg-[#faf8f3] border border-[#0f0e0b]/15 text-base sm:text-sm focus:outline-hidden focus:border-[#0f0e0b] rounded-xs min-h-[44px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-2">
                    Area of Interest
                  </label>
                  <select
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    className="w-full px-4 py-3 bg-[#faf8f3] border border-[#0f0e0b]/15 text-base sm:text-sm focus:outline-hidden focus:border-[#0f0e0b] rounded-xs min-h-[44px] cursor-pointer"
                  >
                    <option value="General enquiry">General enquiry</option>
                    <option value="Hatha Yoga">Hatha Yoga</option>
                    <option value="Barre Yoga">Barre Yoga</option>
                    <option value="Wheel Yoga">Wheel Yoga (Signature)</option>
                    <option value="Chakra Yoga Flow">Chakra Yoga Flow</option>
                    <option value="Private session">Private 1-to-1 session</option>
                    <option value="Class Packs & Corporate">Class Packs & Corporate</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs uppercase tracking-wider text-[#0f0e0b]/70 font-semibold mb-2">
                    Your Message *
                  </label>
                  <textarea
                    required
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell Priyanshi about your experience level, goals, or scheduling preferences..."
                    className="w-full px-4 py-3 bg-[#faf8f3] border border-[#0f0e0b]/15 text-base sm:text-sm focus:outline-hidden focus:border-[#0f0e0b] rounded-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-4 min-h-[48px] bg-[#0f0e0b] hover:bg-[#262420] text-[#faf8f3] text-xs font-semibold uppercase tracking-[0.2em] transition-colors flex items-center justify-center gap-2 rounded-xs"
                >
                  {loading ? (
                    'Sending Message...'
                  ) : (
                    <>
                      <span>Send Message</span>
                      <Send className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
