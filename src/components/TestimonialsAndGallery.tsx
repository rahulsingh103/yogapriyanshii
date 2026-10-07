import React, { useState } from 'react';
import { ASSETS } from '../constants/assets';
import { Star, Instagram, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface TestimonialsAndGalleryProps {
  onOpenBooking: () => void;
}

export const TestimonialsAndGallery: React.FC<TestimonialsAndGalleryProps> = ({
  onOpenBooking,
}) => {
  const [showTestimonials, setShowTestimonials] = useState(true);

  const testimonials = [
    {
      name: 'Nour Al-Sabah',
      role: 'Architect & Long-time Student',
      location: 'Dubai Marina',
      quote:
        'Priyanshi’s Wheel Yoga completely rehabilitated my thoracic spine stiffness after 10-hour days at drafting tables. Her adjustments are gentle yet profoundly transformative.',
    },
    {
      name: 'Julian Henderson',
      role: 'Financial Analyst',
      location: 'DIFC',
      quote:
        'The Monday 7am Barre Yoga is non-negotiable for my week. It brings heat, mental grit, and mental stillness before the markets open.',
    },
    {
      name: 'Dr. Fatima K.',
      role: 'Physician',
      location: 'Downtown Dubai',
      quote:
        'As a medical professional, I deeply respect Priyanshi’s background in Yoga Science. She understands biomechanics and anatomy intimately. The BurJuman Residence studio is a true oasis.',
    },
  ];

  return (
    <section className="py-24 bg-[#f2ede4] border-b border-[#0f0e0b]/8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Toggleable Testimonials Section */}
        <div className="mb-20">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.25em] text-[#c4b48a] font-semibold mb-2">
                Student Words
              </p>
              <h2 className="font-serif text-3xl sm:text-4xl text-[#0f0e0b]">
                Voices from the mat
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setShowTestimonials(!showTestimonials)}
              className="text-xs uppercase tracking-wider text-[#0f0e0b]/60 hover:text-[#0f0e0b] flex items-center gap-1.5 self-start sm:self-auto"
            >
              {showTestimonials ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {showTestimonials ? 'Hide Reviews' : 'Show Reviews'}
            </button>
          </div>

          {showTestimonials && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {testimonials.map((t, idx) => (
                <div
                  key={idx}
                  className="bg-[#faf8f3] p-8 border border-[#0f0e0b]/10 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center gap-1 text-[#c4b48a] mb-4">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-[#c4b48a]" />
                      ))}
                    </div>
                    <p className="font-serif italic text-base text-[#0f0e0b]/85 leading-relaxed mb-6">
                      &ldquo;{t.quote}&rdquo;
                    </p>
                  </div>
                  <div className="pt-4 border-t border-[#0f0e0b]/10 text-xs">
                    <span className="font-semibold block text-[#0f0e0b]">{t.name}</span>
                    <span className="text-[#0f0e0b]/60">
                      {t.role} · {t.location}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Short "A minute with Priyanshi" intro */}
        <div className="bg-[#0f0e0b] text-[#faf8f3] p-8 sm:p-12 mb-20 border border-[#faf8f3]/10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8">
              <span className="text-xs uppercase tracking-[0.25em] text-[#c4b48a] font-semibold block mb-2">
                A Minute with Priyanshi
              </span>
              <h3 className="font-serif text-2xl sm:text-3xl text-[#faf8f3] mb-4">
                &ldquo;Your practice does not require perfection. Only presence.&rdquo;
              </h3>
              <p className="text-xs sm:text-sm text-[#faf8f3]/75 leading-relaxed">
                In a city of high ambition, we often forget that the nervous system requires conscious deceleration. 
                Whether you arrive tired, energized, or carrying tension in your shoulders, we reset together in the studio. 
                All mats, blocks, and bolsters are prepared for your arrival.
              </p>
            </div>
            <div className="lg:col-span-4 flex justify-start lg:justify-end">
              <button
                type="button"
                onClick={onOpenBooking}
                className="px-6 py-3.5 bg-[#c4b48a] hover:bg-[#b3a277] text-[#0f0e0b] text-xs font-semibold uppercase tracking-widest transition-colors flex items-center gap-2"
              >
                <span>Book Free Class</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* "From the studio" Instagram-style photo strip */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#0f0e0b]">
              <Instagram className="w-4 h-4 text-[#c4b48a]" />
              <span>From the Studio · @yogapriyanshi</span>
            </div>
            <a
              href="https://instagram.com/yogapriyanshi"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-[#0f0e0b]/60 hover:text-[#0f0e0b] hover:underline"
            >
              Follow on Instagram →
            </a>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="group relative aspect-square overflow-hidden bg-[#0f0e0b]/10 border border-[#0f0e0b]/10">
              <img
                src={ASSETS.studio}
                alt="Studio at BurJuman Residence Block D"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-[#0f0e0b]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-mono">
                Morning Sanctuary
              </div>
            </div>

            <div className="group relative aspect-square overflow-hidden bg-[#0f0e0b]/10 border border-[#0f0e0b]/10">
              <img
                src={ASSETS.wheel}
                alt="Wheel Yoga Session"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-[#0f0e0b]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-mono">
                Spine Alignment
              </div>
            </div>

            <div className="group relative aspect-square overflow-hidden bg-[#0f0e0b]/10 border border-[#0f0e0b]/10">
              <img
                src={ASSETS.portrait}
                alt="Priyanshi Teacher"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-[#0f0e0b]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-mono">
                Warm Welcome
              </div>
            </div>

            <div className="group relative aspect-square overflow-hidden bg-[#0f0e0b]/10 border border-[#0f0e0b]/10">
              <img
                src={ASSETS.hero}
                alt="Evening Flow Pose"
                className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-[#0f0e0b]/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-mono">
                Deep Inversion
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
