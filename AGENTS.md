# AGENTS.md

## Cursor Cloud specific instructions

### Overview

pnpm workspace monorepo (Turborepo). Two main services: **web** (React/Vite, port 11000) and **api** (Hono.js, port 3000). Shared packages: `types` and `client`.

### Running services

- **Web**: `pnpm dev:web` — starts Vite dev server on port 11000. Works without Supabase (shows offline auth page at `/auth`), but the main notes UI requires valid Supabase credentials because `RepositoryProvider` returns null when there is no authenticated user.
- **API**: `pnpm dev:api` — starts Hono server on port 3000. Will crash on startup without `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `apps/api/.env`.
- Both: `pnpm dev` runs web + api in parallel via Turborepo.

### Supabase dependency

The app requires a hosted Supabase instance (no local Supabase CLI config exists). Environment secrets `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected and must be written into .env files before starting services:
- `apps/api/.env` — needs `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (API crashes without these)
- `apps/web/.env` — needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_API_URL=http://localhost:3000`
- The web app's main notes UI requires `VITE_SUPABASE_ANON_KEY` for authentication; without it the app only shows the offline auth page at `/auth` and `RepositoryProvider` returns null on the home route.
- Root `.env` — `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (optional, used by turbo globalDependencies)

### Commands reference

See `CLAUDE.md` for the full command reference. Key commands:
- `pnpm lint` — lint all packages (0 errors, warnings only)
- `pnpm --filter @triple-a/web type-check` — the pre-commit hook only type-checks web (API type-check has pre-existing JS/TS errors)
- `pnpm --filter @triple-a/web test:run` — run web unit tests (318/321 pass; 3 failures are pre-existing date-sensitive tests)
- `pnpm build` — build all packages (types first, then client, then web/api in parallel)

### Pre-commit hooks

Husky pre-commit hook runs: API lint, Web lint, Web type-check. Use `git commit --no-verify` to skip if needed.

### Known issues

- `@triple-a/api` type-check (`pnpm --filter @triple-a/api type-check`) fails with many TS errors — this is a JS project with type checking enabled, and these are pre-existing issues not gated by CI/pre-commit.
- 3 web test failures in `ActiveFiltersBar.test.tsx` and `DateDisplay.test.tsx` are pre-existing (date-sensitive assertions).
