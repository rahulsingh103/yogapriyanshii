import { AnimateIcon } from '@/components/animate-ui/icons/icon';
import { ArrowRight } from '@/components/animate-ui/icons/arrow-right';
import { ui } from '@/lib/ui';
import { Reveal } from './Reveal';

interface CommunitySectionProps {
  onSeeSchedule: () => void;
}

/** DESIGN_SYSTEM §4 Community: a meditation photo (an AI placeholder until a real group photo arrives), one line and a schedule link. */
export function CommunitySection({ onSeeSchedule }: CommunitySectionProps) {
  return (
    <section id="community" aria-labelledby="community-title" className="py-20 lg:py-32">
      <Reveal className="max-w-[1040px] mx-auto px-5 grid grid-cols-1 sm:grid-cols-2 gap-12 items-center">
        <img
          src="/media/images/practice/chakra-flow-800.webp"
          srcSet="/media/images/practice/chakra-flow-480.webp 480w, /media/images/practice/chakra-flow-800.webp 800w"
          sizes="(min-width: 640px) 500px, min(100vw, 400px)"
          width={800}
          height={993}
          loading="lazy"
          decoding="async"
          alt="Yoga teacher seated cross-legged in meditation"
          className="w-full aspect-[4/5] object-cover rounded-[18px] bg-surface-alt"
        />
        <div className="flex flex-col items-start gap-6">
          <p className={ui.eyebrow}>Community</p>
          <h2 id="community-title" className="font-display font-normal text-h2 text-ink">
            You don&apos;t have to practise alone
          </h2>
          <p className="text-base leading-[1.6] text-ink-soft max-w-[46ch]">
            Group classes bring people of every level and background onto the mat together, in person in Dubai or live
            online. Come as you are, breathe with the room, and leave a little lighter.
          </p>
          <AnimateIcon animateOnHover asChild>
            <button type="button" onClick={onSeeSchedule} className={ui.primary}>
              See the schedule
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </AnimateIcon>
        </div>
      </Reveal>
    </section>
  );
}
