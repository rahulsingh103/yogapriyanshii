/**
 * Three real, verified ClassPass reviews, quoted exactly (design/PRIYANSHI-FACTS.md, owner answer 10).
 * Never edit the wording, never add the venue, and never link the review pages: they name a former studio.
 */

export interface Testimonial {
  quote: string;
  /** The class the review was for, shown as "Verified ClassPass review · <class> class". */
  className: string;
}

export const TESTIMONIALS: ReadonlyArray<Testimonial> = [
  {
    quote:
      'Priyanshi was amazing and made the class really fun! She explained all the exercises clearly and helped with posture and balance — I even did a headstand for the first time ever! Highly recommend and will definitely be going again.',
    className: 'Yoga',
  },
  {
    quote:
      'Amazing class! I felt so refreshed afterward — my tired back feels alive again. Priyanshi is definitely one of the best yoga instructors in Dubai.',
    className: 'Spine Healing',
  },
  {
    quote:
      "I absolutely love Priyanshi's barre yoga classes. She has a beautiful way of combining strength work with deep, intentional stretching that leaves my body feeling open and flexible. I always leave her class feeling both strong and deeply relaxed.",
    className: 'Barre Yoga',
  },
];
