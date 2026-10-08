import React from 'react';
import { ASSETS } from '../constants/assets';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface AboutSectionProps {
  onOpenBooking: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ onOpenBooking }) => {
  return (
    <section id="about" className="py-16 sm:py-20 lg:py-24 bg-[#faf8f3] border-b border-[#0f0e0b]/8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 sm:gap-12 lg:gap-16 items-center">
          {/* Portrait Column */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-4/3 sm:aspect-3/4 overflow-hidden bg-[#f2ede4] border border-[#0f0e0b]/10 rounded-xs">
              <img
                src={ASSETS.portrait}
                alt="Priyanshi, Yoga Instructor in Dubai studio"
                className="w-full h-full object-cover object-center grayscale-20 hover:grayscale-0 transition-all duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0e0b]/40 via-transparent to-transparent" />
            </div>

            {/* Subtle floating quote card (Responsive) */}
            <div className="mt-4 sm:mt-0 sm:absolute sm:-bottom-8 sm:-right-8 bg-[#0f0e0b] text-[#faf8f3] p-5 sm:p-6 sm:max-w-xs border border-[#c4b48a]/30 shadow-lg rounded-xs">
              <p className="font-serif italic text-xs sm:text-sm text-[#faf8f3]/90 leading-relaxed mb-2">
                &ldquo;Yoga isn&apos;t about touching your toes. It&apos;s about what you learn on the way down.&rdquo;
              </p>
              <p className="text-[10px] sm:text-[11px] uppercase tracking-widest text-[#c4b48a] font-medium">
                Priyanshi · Founder
              </p>
            </div>
          </div>

          {/* Text Content Column */}
          <div className="lg:col-span-7">
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#c4b48a] font-semibold mb-2.5 sm:mb-3">
              02. The Instructor
            </p>
            <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#0f0e0b] tracking-tight leading-[1.15] mb-5 sm:mb-6">
              Hello, I&apos;m Priyanshi.
            </h2>

            {/* Lead Narrative */}
            <p className="font-serif italic text-base sm:text-lg text-[#0f0e0b]/85 leading-[1.65] mb-4">
              &ldquo;True strength is quiet. In a fast city, your mat is the one place where nothing needs to be rushed.&rdquo;
            </p>

            <div className="space-y-3.5 text-sm sm:text-base text-[#0f0e0b]/75 leading-[1.75] font-normal mb-6 [text-wrap:pretty]">
              <p>
                My path began in classical yogic science and evolved through an <strong>MA in Yoga Science</strong> and a 200-hour Yoga Alliance certification. Over seven years of teaching across Asia and the Emirates, I have focused on uniting breath, stillness, and deep anatomical awareness.
              </p>
            </div>

            {/* Boutique Sanctuary Highlight Box */}
            <div className="p-4 sm:p-5 bg-[#f2ede4] border border-[#0f0e0b]/10 rounded-xs mb-6 sm:mb-8">
              <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.2em] text-[#c4b48a] font-semibold block mb-1">
                The Sanctuary · BurJuman Residence Block D, Dubai
              </span>
              <p className="text-xs sm:text-sm text-[#0f0e0b]/80 leading-[1.65]">
                Small, intimate class sizes with zero judgment. Classical postures, liberating wheel mobility, and dedicated personal alignment in Bur Dubai.
              </p>
            </div>

            {/* Credentials List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3.5 mb-8 sm:mb-10 text-xs sm:text-sm text-[#0f0e0b]/80">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#c4b48a] shrink-0" />
                <span>Master of Arts in Yogic Science</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#c4b48a] shrink-0" />
                <span>200-Hour Registered Yoga Teacher (E-RYT)</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#c4b48a] shrink-0" />
                <span>Specialized Wheel & Anatomical Alignment</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#c4b48a] shrink-0" />
                <span>BurJuman Residence Block D & Live Streams</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenBooking}
              className="inline-flex items-center justify-center gap-2 px-7 sm:px-8 py-3.5 sm:py-4 min-h-[48px] bg-[#0f0e0b] hover:bg-[#262420] text-[#faf8f3] text-xs font-semibold uppercase tracking-[0.2em] transition-colors rounded-xs whitespace-nowrap shadow-xs"
            >
              <span>Reserve Your First Free Session</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
