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
- Styling: Tailwind utility classes using **design tokens** (`bg-cream`, `text-ink`, `bg-sand`). No new hard-coded hex values and no `!important`. Follow [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md).
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
