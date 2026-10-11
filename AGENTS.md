# AI Agent Instructions

These are instructions for any AI coding agent (Claude Code, Codex, Antigravity…) working on this repo.

## 01 Project context

- **What it is:** yogapriyanshi.com, the website and booking system for Priyanshi, a solo yoga instructor in Dubai.
- **Who uses it:** students book classes (free first class); Priyanshi uses a private admin page.
- **Its standard:** calm, premium and mobile-first.

Read the docs, understand the code, then implement with intent.

## 02 Source of truth

| Doc | Holds |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Goals, users, features, rules, and current status |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Colours, type, spacing, components, motion |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Stack, data flow, directory layout, failure handling |
| [docs/DATABASE.md](docs/DATABASE.md) | Schema and query rules |
| [docs/SECURITY.md](docs/SECURITY.md) | Security rules and env vars |
| [docs/CODE_STYLE.md](docs/CODE_STYLE.md) | Conventions |
| [docs/TESTING.md](docs/TESTING.md) | How to test and what "tested" means |

## 03 Workflow

1. **Inspect:** read the relevant docs and code.
2. **Plan:** break the task down and name the files you'll touch.
3. **Implement:** small, focused changes in existing patterns.
4. **Test:** lint, e2e, and screenshots for UI work.
5. **Review:** correctness, security, performance and design.
6. **Document:** update the docs above if behaviour, APIs or the architecture changed.

## 04 Working rules

**Do:**
- Reuse existing components, utilities and patterns.
- Follow [CODE_STYLE.md](docs/CODE_STYLE.md) and the design tokens.
- Keep changes small and reviewable.

**Avoid:**
- Inventing requirements that aren't in the PRD or the request.
- Committing keys, tokens, passwords or `.env*` files.
- Unrelated rewrites.
- Faking success. For example, never show "booked" when the server failed.

## 05 Validation checklist

Before calling a task done, all of these must pass:
- `npm run lint`
- `npm run test:e2e`
- `npm run build`
- `npm audit --omit=dev` shows no high or critical issues
- The critical flows still work: book a free class, cancel, contact, admin login

## 06 Conflict handling

If the docs, the code and the request disagree:
1. Re-read the relevant docs.
2. Check the existing code.
3. State the conflict plainly.
4. Ask the human; don't guess.

## 07 Definition of done

- The request is fully met.
- The changes are clean, focused and reviewed.
- The relevant docs are updated.
