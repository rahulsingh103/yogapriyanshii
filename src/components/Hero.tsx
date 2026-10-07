import React from 'react';
import { ASSETS } from '../constants/assets';
import { ArrowRight, Star } from 'lucide-react';

interface HeroProps {
  onOpenBooking: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onOpenBooking }) => {
  return (
    <section id="home" className="relative bg-[#0f0e0b] text-[#faf8f3] overflow-hidden">
      {/* Background Image with Moody Scrim */}
      <div className="absolute inset-0 pointer-events-none">
        <img
          src={ASSETS.hero}
          alt="Yoga silhouette in serene backbend"
          className="w-full h-full object-cover object-center opacity-30 scale-105 transition-transform duration-1000"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f0e0b] via-[#0f0e0b]/60 to-transparent" />
        <div className="absolute inset-0 bg-radial from-transparent to-[#0f0e0b]/80" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-14 sm:pt-28 sm:pb-28">
        <div className="max-w-3xl">
          {/* Eyebrow Label */}
          <div className="inline-flex items-center gap-2 mb-4 sm:mb-6">
            <span className="w-6 sm:w-8 h-px bg-[#c4b48a]" />
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#c4b48a] font-medium">
              BurJuman Residence Block D · Dubai
            </p>
          </div>

          {/* Heading */}
          <h1 className="font-serif text-3xl sm:text-6xl lg:text-7xl tracking-tight leading-[1.12] text-[#faf8f3] mb-4 sm:mb-6">
            Connect with your body, <br className="hidden sm:inline" />
            <span className="italic font-normal text-[#c4b48a]">mind & breath.</span>
          </h1>

          {/* Streamlined Subtitle — Clean, Breathing, Non-Repetitive */}
          <p className="text-sm sm:text-lg text-[#faf8f3]/80 font-normal leading-relaxed mb-6 sm:mb-8 max-w-xl">
            Step away from the city&apos;s rush into mindful stillness. Private and boutique group sessions with Priyanshi. Your first class is complimentary.
          </p>

          {/* Clean Typographic Discipline (No Cluttered Pills) */}
          <div className="flex items-center gap-2 sm:gap-3 mb-8 text-[11px] uppercase tracking-[0.2em] text-[#c4b48a] font-medium">
            <span>Hatha</span>
            <span className="text-white/30" aria-hidden="true">·</span>
            <span>Wheel</span>
            <span className="text-white/30" aria-hidden="true">·</span>
            <span>Barre</span>
            <span className="text-white/30" aria-hidden="true">·</span>
            <span>Private 1:1</span>
          </div>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              type="button"
              onClick={onOpenBooking}
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-xs font-semibold uppercase tracking-[0.2em] transition-all rounded-xs shadow-md hover:shadow-lg"
            >
              Book Free First Class
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#schedule"
              className="inline-flex items-center justify-center px-8 py-4 border border-white/20 hover:border-white text-[#faf8f3] text-xs font-semibold uppercase tracking-[0.2em] transition-colors rounded-xs"
            >
              View Schedule
            </a>
          </div>
        </div>
      </div>

      {/* Credibility Stats Strip */}
      <div className="relative border-t border-[#faf8f3]/10 bg-[#0f0e0b]/90 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 items-center text-center divide-y md:divide-y-0 md:divide-x divide-[#faf8f3]/10">
            <div className="pt-3 md:pt-0">
              <span className="block font-serif text-2xl lg:text-3xl text-[#c4b48a]">7+</span>
              <span className="text-[11px] uppercase tracking-wider text-[#faf8f3]/60">Years Experience</span>
            </div>
            <div className="pt-3 md:pt-0">
              <span className="block font-serif text-xl lg:text-2xl text-[#faf8f3]">MA</span>
              <span className="text-[11px] uppercase tracking-wider text-[#faf8f3]/60">Yoga Science</span>
            </div>
            <div className="pt-3 md:pt-0">
              <span className="block font-serif text-2xl lg:text-3xl text-[#faf8f3]">200hr</span>
              <span className="text-[11px] uppercase tracking-wider text-[#faf8f3]/60">Certified YTT</span>
            </div>
            <div className="pt-3 md:pt-0">
              <span className="block font-serif text-2xl lg:text-3xl text-[#faf8f3]">4</span>
              <span className="text-[11px] uppercase tracking-wider text-[#faf8f3]/60">Signature Styles</span>
            </div>
            <div className="pt-3 md:pt-0 col-span-2 md:col-span-1 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1 text-[#c4b48a] mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#c4b48a]" />
                ))}
              </div>
              <span className="text-[11px] uppercase tracking-wider text-[#faf8f3]/60">Rated on ClassPass</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
