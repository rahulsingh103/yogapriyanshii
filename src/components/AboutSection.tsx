import React from 'react';
import { ASSETS } from '../constants/assets';
import { ArrowRight, CheckCircle2 } from 'lucide-react';

interface AboutSectionProps {
  onOpenBooking: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ onOpenBooking }) => {
  return (
    <section id="about" className="py-24 bg-[#faf8f3] border-b border-[#0f0e0b]/8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          {/* Portrait Column */}
          <div className="lg:col-span-5 relative">
            <div className="relative aspect-4/3 sm:aspect-3/4 overflow-hidden bg-[#f2ede4] border border-[#0f0e0b]/10">
              <img
                src={ASSETS.portrait}
                alt="Priyanshi, Yoga Instructor in Dubai studio"
                className="w-full h-full object-cover object-center grayscale-20 hover:grayscale-0 transition-all duration-700"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f0e0b]/40 via-transparent to-transparent" />
            </div>

            {/* Subtle floating quote card */}
            <div className="absolute -bottom-6 -right-4 sm:-bottom-8 sm:-right-8 bg-[#0f0e0b] text-[#faf8f3] p-6 max-w-xs border border-[#c4b48a]/30 shadow-lg hidden sm:block">
              <p className="font-serif italic text-sm text-[#faf8f3]/90 leading-relaxed mb-2">
                &ldquo;Yoga isn&apos;t about touching your toes. It&apos;s about what you learn on the way down.&rdquo;
              </p>
              <p className="text-[11px] uppercase tracking-widest text-[#c4b48a] font-medium">
                Priyanshi · Founder
              </p>
            </div>
          </div>

          {/* Text Content Column */}
          <div className="lg:col-span-7">
            <p className="text-xs uppercase tracking-[0.25em] text-[#c4b48a] font-semibold mb-3">
              02. The Instructor
            </p>
            <h2 className="font-serif text-3xl sm:text-5xl text-[#0f0e0b] tracking-tight mb-6">
              Hello, I&apos;m Priyanshi.
            </h2>

            <div className="space-y-4 text-base sm:text-lg text-[#0f0e0b]/80 leading-relaxed font-normal mb-8">
              <p>
                A path that began in the ancient tradition of yogic science and evolved through rigorous academic study with an <strong>MA in Yoga Science</strong> and a 200-hour Yoga Alliance certification.
              </p>
              <p>
                Over seven years of teaching across Asia and the Emirates, I have found that true strength is quiet. My classes at <strong>BurJuman Residence Block D, Dubai</strong>, bring classical precision together with contemporary anatomical awareness. Whether you are holding your first downward dog or unrolling your spine onto the yoga wheel, you are met with patient, individual guidance.
              </p>
              <p className="text-base text-[#0f0e0b]/70">
                I believe in small class sizes, intentional sequencing, and no judgment. Every session is an invitation to inhabit your breath and leave the rush behind.
              </p>
            </div>

            {/* Credentials List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10 text-xs sm:text-sm text-[#0f0e0b]/80">
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
                <span>In-Person at BurJuman Residence Block D & Live Streams</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenBooking}
              className="inline-flex items-center gap-2 px-8 py-4 bg-[#0f0e0b] hover:bg-[#262420] text-[#faf8f3] text-xs font-semibold uppercase tracking-[0.2em] transition-colors"
            >
              Reserve Your First Free Session
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
