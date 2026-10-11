/** Shared token class strings for buttons, form controls and notices (DESIGN_SYSTEM §4). Tokens only. */
export const ui = {
  label: 'block text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft',
  input:
    'w-full h-12 px-4 bg-surface-alt rounded-[12px] border border-transparent text-base text-ink placeholder:text-ink-soft focus:outline-none focus-visible:outline-none focus:border-ink focus:ring-1 focus:ring-ink transition-[border-color,box-shadow] duration-200',
  textarea:
    'w-full px-4 py-3 bg-surface-alt rounded-[12px] border border-transparent text-base text-ink placeholder:text-ink-soft focus:outline-none focus-visible:outline-none focus:border-ink focus:ring-1 focus:ring-ink transition-[border-color,box-shadow] duration-200',
  primary:
    'inline-flex items-center justify-center gap-2 min-h-12 px-[22px] py-[14px] rounded-full bg-ink text-on-ink text-xs font-semibold uppercase tracking-[0.14em] hover:opacity-90 transition-opacity duration-200 disabled:opacity-40 disabled:cursor-not-allowed',
  secondary:
    'inline-flex items-center justify-center gap-2 min-h-12 px-[22px] py-[14px] rounded-full border border-line text-ink text-xs font-semibold uppercase tracking-[0.14em] hover:border-ink transition-colors duration-200 disabled:opacity-40 disabled:cursor-not-allowed',
  eyebrow: 'text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft',
  title: 'font-display font-normal text-[34px] sm:text-[40px] leading-[1.05] text-ink pr-12',
  error: 'p-4 rounded-[12px] bg-error-bg text-error text-sm leading-[1.5]',
  notice: 'p-4 rounded-[12px] bg-calm-bg text-ink text-sm leading-[1.5]',
  panel: 'p-4 rounded-[12px] bg-surface-alt',
} as const;
