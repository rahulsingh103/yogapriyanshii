import React from 'react';
import { Instagram } from 'lucide-react';

interface FooterProps {
  onOpenBooking: () => void;
  onOpenCancel: () => void;
  onOpenAdmin: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onOpenBooking,
  onOpenCancel,
  onOpenAdmin,
}) => {
  return (
    <footer className="bg-[#0f0e0b] text-[#faf8f3] border-t border-[#faf8f3]/10 pt-16 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <h3 className="font-serif text-2xl sm:text-3xl text-[#faf8f3] mb-3">
              YogaPriyanshi
            </h3>
            <p className="font-serif italic text-sm text-[#c4b48a] mb-4">
              Connect with your body.
            </p>
            <p className="text-xs text-[#faf8f3]/60 leading-relaxed max-w-sm mb-6">
              Mindful movement, classical alignment, and liberating spine mobility at BurJuman Residence Block D, Dubai. In-person sanctuary and live interactive stream.
            </p>
            <div className="flex items-center gap-4 text-xs text-[#faf8f3]/60">
              <a
                href="https://instagram.com/yogapriyanshi"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#c4b48a] transition-colors flex items-center gap-1.5"
              >
                <Instagram className="w-4 h-4 text-[#c4b48a]" />
                @yogapriyanshi
              </a>
              <span>·</span>
              <span>ClassPass 5★</span>
              <span>·</span>
              <span>FindYoga Dubai</span>
            </div>
          </div>

          {/* Practice Links */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-[#c4b48a] font-semibold mb-4">
              Practices
            </h4>
            <ul className="space-y-2.5 text-xs text-[#faf8f3]/70">
              <li>
                <a href="#classes" className="hover:text-[#faf8f3] transition-colors">
                  Hatha Yoga (Foundations)
                </a>
              </li>
              <li>
                <a href="#classes" className="hover:text-[#faf8f3] transition-colors">
                  Barre Yoga (Strength & Tone)
                </a>
              </li>
              <li>
                <a href="#classes" className="hover:text-[#faf8f3] transition-colors">
                  Wheel Yoga (Signature Spine)
                </a>
              </li>
              <li>
                <a href="#classes" className="hover:text-[#faf8f3] transition-colors">
                  Chakra Yoga Flow (Restorative)
                </a>
              </li>
              <li>
                <a href="#classes" className="hover:text-[#faf8f3] transition-colors">
                  Private 1-to-1 Sessions
                </a>
              </li>
            </ul>
          </div>

          {/* Studio Info & Actions */}
          <div>
            <h4 className="text-xs uppercase tracking-widest text-[#c4b48a] font-semibold mb-4">
              Studio & Policies
            </h4>
            <p className="text-xs text-[#faf8f3]/70 leading-relaxed mb-3">
              BurJuman Residence Block D<br />
              Bur Dubai, Dubai<br />
              United Arab Emirates
            </p>
            <p className="text-[11px] text-[#faf8f3]/50 mb-4 font-mono">
              Mon–Sun 6:30 AM – 8:00 PM (GMT+4)
            </p>
            <div className="space-y-2 text-xs">
              <button
                type="button"
                onClick={onOpenCancel}
                className="block text-[#c4b48a] hover:underline"
              >
                Manage / Cancel Reservation →
              </button>
              <button
                type="button"
                onClick={onOpenAdmin}
                className="block text-[#faf8f3]/50 hover:text-[#faf8f3]"
              >
                Admin Dashboard Portal
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-[#faf8f3]/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#faf8f3]/50">
          <p>© {new Date().getFullYear()} YogaPriyanshi. All rights reserved. Dubai, UAE.</p>
          <p>
            Cancellations free up to 6 hours before class. First class is always free.
          </p>
        </div>
      </div>
    </footer>
  );
};
