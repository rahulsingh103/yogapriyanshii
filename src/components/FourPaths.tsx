import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface FourPathsProps {
  onSelectClass: (classId: string) => void;
}

export const FourPaths: React.FC<FourPathsProps> = ({ onSelectClass }) => {
  const classes = [
    {
      id: 'hatha',
      name: 'Hatha Yoga',
      level: 'All levels',
      duration: '60 min',
      slot: 'Tuesday 6:00 PM · Sunday 10:00 AM',
      description:
        'The classical root of the practice — foundational postures, precise alignment, and the relationship between breath and movement. No experience necessary.',
    },
    {
      id: 'barre',
      name: 'Barre Yoga',
      level: 'All levels',
      duration: '60 min',
      slot: 'Monday 7:00 AM · Wednesday 7:00 AM',
      description:
        'Strength work woven with deep, intentional stretching. Small controlled movements build heat and tone, then long holds open everything back up.',
    },
    {
      id: 'wheel',
      name: 'Wheel Yoga',
      level: 'All levels',
      duration: '75 min',
      slot: 'Thursday 6:00 PM',
      highlight: "Priyanshi's Signature",
      description:
        "Priyanshi's signature class. The yoga wheel supports the spine through backbends and chest openers that feel impossible without it — then suddenly don't.",
    },
    {
      id: 'chakra',
      name: 'Chakra Yoga Flow',
      level: 'Beginner friendly',
      duration: '60 min',
      slot: 'Saturday 9:00 AM',
      description:
        "A moving meditation through the body's energy centres, pairing breath, sound, and sequence. Grounding, clearing, and deeply restorative.",
    },
  ];

  return (
    <section className="py-16 sm:py-20 lg:py-24 bg-[#faf8f3] border-b border-[#0f0e0b]/8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-10 sm:mb-12 lg:mb-16">
          <p className="text-[10px] sm:text-[11px] uppercase tracking-[0.25em] text-[#c4b48a] font-semibold mb-2.5 sm:mb-3">
            01. Signature Practices
          </p>
          <h2 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#0f0e0b] tracking-tight leading-[1.15] mb-3 sm:mb-4 [text-wrap:balance]">
            Four paths to stillness
          </h2>
          <p className="text-sm sm:text-base text-[#0f0e0b]/75 leading-[1.7] [text-wrap:pretty]">
            Each discipline has been designed to meet you where your body is today. 
            From the deep anatomical alignment of classical Hatha to the liberating spine opening of Wheel Yoga.
          </p>
        </div>

        {/* Classes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
          {classes.map((item) => (
            <div
              key={item.id}
              className="group relative bg-[#f2ede4] border border-[#0f0e0b]/8 p-6 sm:p-8 lg:p-10 flex flex-col justify-between hover:border-[#c4b48a] transition-colors rounded-xs"
            >
              <div>
                <div className="flex items-center justify-between gap-4 text-xs text-[#0f0e0b]/60 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-[#0f0e0b]">{item.level}</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.duration}</span>
                  </div>
                  {item.highlight && (
                    <span className="text-[#c4b48a] font-semibold uppercase tracking-wider text-[11px]">
                      {item.highlight}
                    </span>
                  )}
                </div>

                <h3 className="font-serif text-2xl sm:text-3xl text-[#0f0e0b] group-hover:text-[#0f0e0b] mb-3">
                  {item.name}
                </h3>

                <p className="text-sm sm:text-base text-[#0f0e0b]/75 leading-relaxed mb-6 [text-wrap:pretty]">
                  {item.description}
                </p>

                <p className="text-xs text-[#0f0e0b]/55 font-mono mb-6">
                  Typical slot: {item.slot}
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => onSelectClass(item.id)}
                  className="inline-flex items-center gap-2 min-h-[44px] text-xs font-semibold uppercase tracking-[0.15em] text-[#0f0e0b] hover:text-[#c4b48a] transition-colors group-hover:translate-x-1 duration-200"
                >
                  <span>Book This Style</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
