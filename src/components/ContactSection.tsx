import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { ui } from '@/lib/ui';
import { Reveal } from './Reveal';

interface ContactSectionProps {
  onOpenContact: () => void;
}

/** DESIGN_SYSTEM §4 Contact: a heading, one address line and one button that opens the contact pop-up. */
export function ContactSection({ onOpenContact }: ContactSectionProps) {
  return (
    <section id="contact" className="py-20 lg:py-32 px-5">
      <Reveal className="max-w-[640px] mx-auto flex flex-col items-center gap-6 text-center">
        <h2 className="font-display font-normal text-[clamp(34px,5.5vw,58px)] leading-[1.05] text-ink">Get in touch</h2>
        <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
          BurJuman Residence Block D, Bur Dubai, Dubai
        </p>
        <AnimateIcon animateOnHover asChild>
          <button type="button" onClick={onOpenContact} className={ui.primary}>
            Contact Priyanshi
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </AnimateIcon>
      </Reveal>
    </section>
  );
}
