# Code Style

These are the conventions in this codebase. Match them.

## General

- TypeScript everywhere. Run `npm run lint` (`tsc --noEmit`); it must pass with no errors.
- **Small, focused changes.** Don't refactor unrelated code. Reuse existing components, the API helpers in `src/services/api.ts` and the types in `src/types/`.
- Comments explain **why**, not what. Match the surrounding comment density.

## React (`src/`)

- Function components with named exports: `export function Hero() {}` in `components/Hero.tsx`, one component per file, named in PascalCase.
- State uses `useState`/`useEffect` locally; app-level modal state lives in `App.tsx`. Don't add a state library.
- Animation: `motion` (`motion/react`). Icons: `lucide-react`, or Animate UI icons for animated ones.
- Motion bundle: `LazyMotion` + `domAnimation` with `m.*` components. Never `motion.*` or `domMax`. For imperative animation use `animateSingleValue` (already in the `domAnimation` bundle), not the heavier hybrid `animate`. It's an internal re-export from `motion-dom`, not documented public API, so `motion` is pinned to `~12.43` in `package.json`: check it still exists before raising the minor version.
- Springs: anything interactive animates with a spring (`type: 'spring'`, `bounce` + `duration`), never a fixed curve. Use `bounce: 0` by default and a small bounce only after a gesture with momentum; pass the release velocity on. Gestures use Pointer Events with `setPointerCapture`, a 10px threshold and the shared maths in `src/lib/gesture.ts` (rubber band, momentum projection, release velocity). Check reduced motion with `useReducedMotion()` and swap slides for cross-fades or instant moves.
- Styling: Tailwind utility classes using **design tokens** (`bg-bg`, `bg-surface`, `text-ink`, `text-ink-soft`, `border-line`, `text-accent-text`); shared button, input and notice strings live in `src/lib/ui.ts`. Modals use `ModalSheet`. No new hard-coded hex values and no `!important`. Follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
- All network calls go through `api.*` in `src/services/api.ts`. Errors surface as `ApiError` with a human message, shown in the UI and never printed with `console.error`.
- Accessibility: every input has a label, every image has `alt`, buttons are `<button>`, links are `<a>`.

## Server (`backend/`)

- All API code lives in `backend/`; `server.ts` and `api/index.ts` only mount `createApp()`. Relative imports use `.js` suffixes (Node ESM on Vercel).
- Routes are in `backend/routes.ts`. Validate input first (`backend/validate.ts`), then throw `HttpError(status, '<human message>')`; the error handler turns it into `{ error }`.
- Put the business rules in one function per rule (capacity, free class, cancellation window) so they're testable and shared.
- Database access is parameterized only (see [DATABASE.md](DATABASE.md)).
- Log events, not people: `booking_created id=…`, never names or emails.

## Naming

| Kind | Style |
|---|---|
| Variables and functions | `camelCase` |
| Types and components | `PascalCase` |
| Constants | `UPPER_SNAKE` |
| API JSON fields | `camelCase` |
| Database columns | `snake_case` |

## Git

- `main` is the live site.
- Commit messages are short and imperative ("Add Turso booking store").
- Never commit `.env*`, `credentials/`, `dist/` or test output.
