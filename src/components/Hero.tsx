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

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-14 sm:pt-24 sm:pb-24 lg:pt-28 lg:pb-28">
        <div className="max-w-3xl">
          {/* Eyebrow Label with boutique spacing */}
          <div className="inline-flex items-center gap-2.5 mb-3.5 sm:mb-5">
            <span className="w-5 sm:w-7 h-px bg-[#c4b48a]" />
            <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#c4b48a] font-semibold">
              BurJuman Residence Block D · Dubai
            </p>
          </div>

          {/* Heading with text-wrap balance and intentional line height */}
          <h1 className="font-serif text-3xl sm:text-5xl lg:text-6xl xl:text-7xl tracking-tight leading-[1.12] text-[#faf8f3] mb-4 sm:mb-5 [text-wrap:balance]">
            Connect with your body, <br className="hidden sm:inline" />
            <span className="italic font-normal text-[#c4b48a]">mind & breath.</span>
          </h1>

          {/* Subtitle — Harmonious measure & line height */}
          <p className="text-sm sm:text-base lg:text-lg text-[#faf8f3]/80 font-normal leading-[1.7] mb-6 sm:mb-7 max-w-xl [text-wrap:pretty]">
            Step away from the city&apos;s rush into mindful stillness. Private and boutique group sessions with Priyanshi. Your first class is complimentary.
          </p>

          {/* Clean Typographic Discipline */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-7 sm:mb-8 text-[11px] sm:text-xs uppercase tracking-[0.2em] text-[#c4b48a] font-medium">
            <span>Hatha</span>
            <span className="text-white/30" aria-hidden="true">·</span>
            <span>Wheel</span>
            <span className="text-white/30" aria-hidden="true">·</span>
            <span>Barre</span>
            <span className="text-white/30" aria-hidden="true">·</span>
            <span>Private 1:1</span>
          </div>

          {/* CTAs with minimum 48px touch targets */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
            <button
              type="button"
              onClick={onOpenBooking}
              className="inline-flex items-center justify-center gap-2 px-7 sm:px-8 py-3.5 sm:py-4 min-h-[48px] bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-xs font-semibold uppercase tracking-[0.2em] transition-all rounded-xs shadow-md hover:shadow-lg whitespace-nowrap"
            >
              <span>Book Free First Class</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <a
              href="#schedule"
              className="inline-flex items-center justify-center px-7 sm:px-8 py-3.5 sm:py-4 min-h-[48px] border border-white/20 hover:border-white text-[#faf8f3] text-xs font-semibold uppercase tracking-[0.2em] transition-colors rounded-xs whitespace-nowrap"
            >
              View Schedule
            </a>
          </div>
        </div>
      </div>

      {/* Credibility Stats Strip with Tabular Figures */}
      <div className="relative border-t border-[#faf8f3]/10 bg-[#0f0e0b]/90 backdrop-blur-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 sm:gap-6 items-center text-center">
            <div className="p-3 sm:p-2">
              <span className="block font-serif tabular-nums text-2xl lg:text-3xl text-[#c4b48a]">7+</span>
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#faf8f3]/60">Years Experience</span>
            </div>
            <div className="p-3 sm:p-2 border-l border-[#faf8f3]/10">
              <span className="block font-serif text-xl lg:text-2xl text-[#faf8f3]">MA</span>
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#faf8f3]/60">Yoga Science</span>
            </div>
            <div className="p-3 sm:p-2 border-t sm:border-t-0 md:border-l border-[#faf8f3]/10">
              <span className="block font-serif tabular-nums text-2xl lg:text-3xl text-[#faf8f3]">200hr</span>
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#faf8f3]/60">Certified YTT</span>
            </div>
            <div className="p-3 sm:p-2 border-t sm:border-t-0 border-l border-[#faf8f3]/10">
              <span className="block font-serif tabular-nums text-2xl lg:text-3xl text-[#faf8f3]">4</span>
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#faf8f3]/60">Signature Styles</span>
            </div>
            <div className="p-3 sm:p-2 col-span-2 md:col-span-1 border-t md:border-t-0 md:border-l border-[#faf8f3]/10 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1 text-[#c4b48a] mb-1">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-[#c4b48a]" />
                ))}
              </div>
              <span className="text-[10px] sm:text-[11px] uppercase tracking-wider text-[#faf8f3]/60">Rated 5.0 on ClassPass</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
