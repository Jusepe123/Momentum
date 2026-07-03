# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Momentum** — a training tracker (strength / run / swim) that unifies every session into one load value (session-RPE: `rpe × duration_min`), monitors injury risk via ACWR rolling windows, tracks per-sport progress (estimated 1RM, pace), and projects future gains from trend fits. Product spec lives in `momentum-kickoff-prompt.md`. All UI copy is **English**.

Stack: Vite + React 19 + TypeScript, Tailwind v4 (tokens in `src/index.css` `@theme`, no tailwind.config), React Query v5, react-router v7, Recharts, Vitest, Supabase (Postgres + Auth + RLS). Frontend deploys to AWS Amplify Hosting; Supabase is managed through the Supabase MCP server.

## Commands

- `npm run dev` — dev server (Vite, http://localhost:5173)
- `npm run build` — typecheck (`tsc -b`) + production build; treat warnings as actionable
- `npm test` / `npx vitest run` — all tests once
- `npx vitest run src/lib/scoring/acwr.test.ts` — single test file
- `npx vitest run -t "zone boundaries"` — tests matching a name
- `npm run lint` — oxlint

Requires `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see `.env.example`; git-ignored).

## Architecture

Three layers, strictly ordered; dependencies only point downward:

1. **Pure math — `src/lib/scoring/`**: `sessionLoad`, `estimate1RM` (Epley + Brzycki, reps capped at 36), `riegelPredict`, pace helpers, `acwr` (7-day acute / 28-day chronic windows, both inclusive of `asOf`), `detectPlateau`, `detectPR`, `fitTrend`/`projectMetric` (projections need ≥4 points spanning ≥14 days). No I/O. **Test-first is the norm here** — every function has co-located `*.test.ts`; expected values in tests are computed with `node -e`, never by hand. Date math goes through `epochDay()` (`src/lib/scoring/dates.ts`); rolling-window off-by-ones are the classic bug, so boundary cases are always tested explicitly.
2. **Data — `src/features/*/hooks.ts` + `src/lib/supabase.ts`**: typed Supabase client (`Database` types generated from the live schema into `src/lib/database.types.ts` — regenerate via MCP `generate_typescript_types` after every migration). React Query throughout; the auth listener in `src/features/auth/AuthProvider.tsx` clears the query cache on sign-out/user-switch (cross-account leak guard — keep it).
3. **UI — `src/features/{auth,sessions,dashboard}/`**: pages + `src/components/ui.tsx` primitives. Dashboard chart data comes from pure, tested selectors (`src/features/dashboard/selectors.ts`), never computed inline in components.

## Database (Supabase)

Schema: `sessions` (with `unified_load` as a **generated column**), `strength_sets`, `cardio_details` (1:1, run/swim), `exercises` (rows with `user_id NULL` are global seeds). Migrations live in `supabase/migrations/` and are applied with MCP `apply_migration` — keep the local file and the applied migration identical.

Non-negotiable invariants (each one broke or nearly broke something already):

- **Never write `unified_load`** — it's generated; Postgres rejects the insert.
- **Sessions store the user's local calendar date** — use `todayLocalISO()` (`src/lib/dates.ts`), never `toISOString()`, or ACWR day buckets shift near midnight.
- **Fetch sessions + details in one query** (`SESSION_SELECT` embedded-resource string in `src/features/sessions/hooks.ts`) — no per-session round trips.
- **Session detail edits go through the `replace_session_details` RPC** (migration 0002), which is transactional and branches on the session's sport. Don't reintroduce client-side delete-then-insert.
- RLS on every table uses `(select auth.uid())`; child tables derive ownership from the parent session; `anon` has zero grants. Triggers enforce sport/detail consistency and freeze a session's sport once details exist.
- Any schema change: run the `database-reviewer` agent on the migration file **before** applying it (this has caught CRITICAL issues twice), then check `get_advisors` after applying.

## Design system

Dark-only. Tokens in `src/index.css`: surface/panel/ink neutrals + one amber accent (`--color-accent`), Inter for text, Space Grotesk (`font-display`) for headings and numerals. Charts: shared theme in `src/features/dashboard/chartTheme.ts`; no dual-axis charts (stack two x-aligned charts instead); risk zones always render a text label alongside the color, never color alone.

## Notes

- The user may have `[demo]`-tagged seed sessions in the dev database (identifiable via `notes like '[demo]%'`); delete only those when asked to clean up demo data.
- A UI redesign is planned from files the user will drop into `design/` — treat it as a reskin: presentation only, logic/data/a11y intact.
