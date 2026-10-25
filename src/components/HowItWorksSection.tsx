import { CALL_PREFILL, WHATSAPP_ENABLED, whatsappUrl } from '@/constants/contact';
import { Reveal } from './Reveal';
import { WhatsAppGlyph } from './WhatsAppGlyph';

const STEPS: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: 'Book your free first class',
    body: 'Choose a class and a time on the schedule, in person in Dubai or live online. No card needed.',
  },
  {
    title: 'Hear from Priyanshi',
    body: 'She messages you to confirm the details. For an online class, she sends you the class link.',
  },
  {
    title: 'Practise',
    body: 'Wear comfortable clothes and bring water. Arrive or log in 5 to 10 minutes early.',
  },
];

/** Owner answer 7 plus amendment B1. Nothing here suggests that Priyanshi gives medical clearance. */
const SAFETY: ReadonlyArray<string> = [
  'Tell Priyanshi about any injury, health condition or pregnancy before class.',
  'Avoid a heavy meal for 2 hours before you practise.',
  'Classes welcome all levels: Priyanshi teaches with safe sequencing and alignment, and she is trained in prenatal yoga.',
];

/**
 * DESIGN_SYSTEM §4 How it works: three numbered steps, a compact "Practise safely" note, and (while
 * WhatsApp is enabled) one text link that opens WhatsApp asking for a free 15-minute call.
 */
export function HowItWorksSection() {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-title" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 flex flex-col gap-12">
        <div className="flex flex-col gap-6">
          <h2 id="how-it-works-title" className="font-display font-normal text-h2 text-ink">
            How it works
          </h2>
          <ol className="grid grid-cols-1 sm:grid-cols-3 gap-8 sm:gap-6">
            {STEPS.map((step, i) => (
              <li key={step.title} className="flex flex-col gap-2 pt-6 border-t border-line">
                <span aria-hidden="true" className="font-display text-h3 text-accent-text tabular-nums">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <h3 className="font-display font-normal text-h4 text-ink">{step.title}</h3>
                <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-3" data-testid="safety-note">
          <h3 className="font-display font-normal text-h4 text-ink">Practise safely</h3>
          <ul className="flex flex-col gap-2 list-disc pl-5 marker:text-ink-faint max-w-[64ch]">
            {SAFETY.map((line) => (
              <li key={line} className="text-sm leading-[1.5] text-ink-soft">
                {line}
              </li>
            ))}
          </ul>
        </div>

        {WHATSAPP_ENABLED && (
          <p className="text-base leading-[1.6] text-ink-soft">
            Not sure where to start?{' '}
            <a
              href={whatsappUrl(CALL_PREFILL)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 min-h-11 align-middle font-semibold text-ink underline underline-offset-4 decoration-line hover:decoration-ink transition-colors duration-200"
            >
              <WhatsAppGlyph size={16} />
              Book a free 15-minute call
            </a>
          </p>
        )}
      </Reveal>
    </section>
  );
}
