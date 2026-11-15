import { ModalSheet } from './ModalSheet';

interface PrivacyChoicesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TITLE_ID = 'privacy-choices-title';

/**
 * "Your privacy choices" (owner-approved 2026-11-14). Honest: the site only has the essential login
 * cookie, so there is nothing to switch off and no fake toggles. Keep it in step with privacy.ts.
 */
export function PrivacyChoicesModal({ isOpen, onClose }: PrivacyChoicesModalProps) {
  return (
    <ModalSheet isOpen={isOpen} onClose={onClose} labelledBy={TITLE_ID} closeLabel="Close privacy choices">
      <div className="flex flex-col gap-[18px]">
        <h2 id={TITLE_ID} className="font-display font-normal text-2xl leading-[1.15] text-ink">
          Your privacy choices
        </h2>
        <p className="text-sm leading-[1.6] text-ink-soft">We keep this simple. This website uses only what it needs to work.</p>
        <div className="rounded-[14px] border border-line p-4 flex items-start justify-between gap-3.5">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold text-ink">Essential</p>
            <p className="text-[13px] leading-[1.5] text-ink-soft">
              Keeps you logged in if you make an account (up to 30 days), and remembers that you have one. The site can't work without it.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-sage-soft px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.1em] text-ink">Always on</span>
        </div>
        <div className="rounded-[14px] border border-line bg-sage-soft p-4 flex flex-col gap-1">
          <p className="text-sm font-semibold text-ink">Analytics, advertising and tracking</p>
          <p className="text-[13px] leading-[1.5] text-ink-soft">None. We don't use them, so there is nothing to turn off.</p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <a href="/privacy" className="text-sm text-ink underline underline-offset-4 decoration-line-strong hover:decoration-ink">
            Read the privacy policy
          </a>
          <button
            type="button"
            onClick={onClose}
            className="press inline-flex items-center min-h-12 px-[22px] rounded-full bg-ink text-on-ink text-xs font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition duration-200 ease-spring active:duration-100"
          >
            Got it
          </button>
        </div>
      </div>
    </ModalSheet>
  );
}
