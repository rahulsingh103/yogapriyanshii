/** The tick-and-cross toggle mark used for "Your privacy choices". Decorative. */
export function PrivacyChoicesIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 30 14" aria-hidden="true" className={className}>
      <rect x="0.75" y="0.75" width="28.5" height="12.5" rx="6.25" className="fill-bg stroke-ink" strokeWidth="1.5" />
      <path d="M15 0.75 H22.75 A6.25 6.25 0 0 1 22.75 13.25 H15 Z" className="fill-ink" />
      <path d="M5.6 7.2 L7.4 9 L10.8 5.2" fill="none" className="stroke-ink" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19.6 4.8 L23.8 9.2 M23.8 4.8 L19.6 9.2" className="stroke-bg" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
