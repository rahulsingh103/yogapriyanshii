import { Instagram } from 'lucide-react';

interface FooterProps {
  onOpenCancel: () => void;
  onOpenAdmin: () => void;
}

const QUIET_BUTTON =
  'inline-flex items-center min-h-11 text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft hover:text-ink transition-colors duration-200';

export function Footer({ onOpenCancel, onOpenAdmin }: FooterProps) {
  return (
    <footer className="border-t border-line">
      <div className="max-w-[1040px] mx-auto px-5 py-16 flex flex-col gap-12">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-8">
          <div className="flex flex-col gap-3">
            <a href="#home" className="self-start inline-flex items-center min-h-11 font-display text-2xl leading-none text-ink">
              YogaPriyanshi
            </a>
            <p className="text-sm leading-[1.5] text-ink-soft">BurJuman Residence Block D, Bur Dubai, Dubai</p>
            <a
              href="https://instagram.com/yogapriyanshi"
              target="_blank"
              rel="noopener noreferrer"
              className="self-start inline-flex items-center gap-2 min-h-11 text-sm text-ink-soft hover:text-ink transition-colors duration-200"
            >
              <Instagram className="size-4 text-accent-text" aria-hidden="true" />
              @yogapriyanshi
            </a>
          </div>

          <div className="flex flex-col items-start sm:items-end gap-1">
            <button type="button" onClick={onOpenCancel} className={QUIET_BUTTON}>
              Manage booking
            </button>
            <button type="button" onClick={onOpenAdmin} className={QUIET_BUTTON}>
              Studio admin
            </button>
          </div>
        </div>

        <div className="pt-6 border-t border-line flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs leading-[1.5] text-ink-soft">
          <p>Free cancellation up to 6 hours before class. Your first class is always free.</p>
          <p>© {new Date().getFullYear()} YogaPriyanshi · Dubai</p>
        </div>
      </div>
    </footer>
  );
}
