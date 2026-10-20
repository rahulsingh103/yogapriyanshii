import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { WHATSAPP_ENABLED, WHATSAPP_PREFILL, whatsappUrl } from '@/constants/contact';
import { cn } from '@/lib/utils';
import { ui } from '@/lib/ui';
import { Reveal } from './Reveal';
import { WhatsAppGlyph } from './WhatsAppGlyph';

/** On phones the two pills stack at one shared width; side by side from 640px they size to their text. */
const PILL_WIDTH = 'w-full max-w-[280px] sm:w-auto';

interface ContactSectionProps {
  onOpenContact: () => void;
}

/**
 * DESIGN_SYSTEM §4 Contact: a heading, one address line and one button that opens the contact pop-up,
 * plus a secondary WhatsApp link while WhatsApp is enabled.
 */
export function ContactSection({ onOpenContact }: ContactSectionProps) {
  return (
    <section id="contact" className="py-20 lg:py-32 px-5">
      <Reveal className="max-w-[640px] mx-auto flex flex-col items-center gap-6 text-center">
        <h2 className="font-display font-normal text-h2 text-ink">Get in touch</h2>
        <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
          Dubai, UAE · Private and small-group sessions, in person or online
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <AnimateIcon animateOnHover asChild>
            <button type="button" onClick={onOpenContact} className={cn(ui.primary, WHATSAPP_ENABLED && PILL_WIDTH)}>
              Contact Priyanshi
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </AnimateIcon>
          {WHATSAPP_ENABLED && (
            <a href={whatsappUrl(WHATSAPP_PREFILL)} target="_blank" rel="noopener noreferrer" className={cn(ui.secondary, PILL_WIDTH)}>
              <WhatsAppGlyph size={16} />
              Chat on WhatsApp
            </a>
          )}
        </div>
      </Reveal>
    </section>
  );
}
