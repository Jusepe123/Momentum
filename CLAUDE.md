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
3. **UI — `src/features/{auth,sessions,dashboard,routines}/`**: pages + `src/components/ui.tsx` primitives (incl. `Chip` for quick-pick selectors). Dashboard chart data comes from pure, tested selectors (`src/features/dashboard/selectors.ts`), never computed inline in components. The log form has no raw RPE slider: effort is four labeled chips (Easy/Moderate/Hard/Max effort → rpe 3/5/7/9) and duration is preset chips + custom — both still persist `rpe`/`duration_min`, which the ACWR load model requires for every sport.

## Database (Supabase)

Schema: `sessions` (with `unified_load` as a **generated column**), `strength_sets`, `cardio_details` (1:1, run/swim), `exercises` (rows with `user_id NULL` are global seeds), `routines` + `routine_sets` (strength templates; `weight_kg` nullable target). Migrations live in `supabase/migrations/` and are applied with MCP `apply_migration` — keep the local file and the applied migration identical.

Non-negotiable invariants (each one broke or nearly broke something already):

- **Never write `unified_load`** — it's generated; Postgres rejects the insert.
- **Sessions store the user's local calendar date** — use `todayLocalISO()` (`src/lib/dates.ts`), never `toISOString()`, or ACWR day buckets shift near midnight.
- **Fetch sessions + details in one query** (`SESSION_SELECT` embedded-resource string in `src/features/sessions/hooks.ts`) — no per-session round trips.
- **Session detail edits go through the `replace_session_details` RPC** (migration 0002), which is transactional and branches on the session's sport. Don't reintroduce client-side delete-then-insert. Routine set edits likewise go through `replace_routine_sets` (migration 0003), which also validates every `exercise_id` is global or caller-owned (FK checks bypass RLS).
- RLS on every table uses `(select auth.uid())`; child tables derive ownership from the parent session; `anon` has zero grants. Triggers enforce sport/detail consistency and freeze a session's sport once details exist.
- Any schema change: run the `database-reviewer` agent on the migration file **before** applying it (this has caught CRITICAL issues twice), then check `get_advisors` after applying.

## Design system

Light editorial minimal. Tokens in `src/index.css` `@theme`: warm off-white page (`--color-surface`), white cards (`panel`) with hairline borders (`line`), near-black ink text, one amber accent (`--color-accent`, use sparingly — data/brand only; primary buttons are ink, not amber), plus per-sport identity hues `--color-sport-{strength,run,swim}` (amber/teal/blue — CVD-checked; class maps in `src/components/sportColors.ts`, pictogram SVGs in `src/components/sportIcons.tsx`). Inter for text, Space Grotesk (`font-display`) for headings and numerals. Charts: shared theme in `src/features/dashboard/chartTheme.ts`; no dual-axis charts (stack two x-aligned charts instead); risk zones always render a text label alongside the color, never color alone.

Brand assets are drop-in overrides (see `public/brand/README.md`): `src/components/brand.tsx` tries `/brand/logo.png` (falls back to an inline SVG mark) and `/brand/dashboard-hero.png` (renders nothing if absent) — the user drops PNGs there, no code change.

Gotcha: `Input`/`Select` bake in `w-full`, and in the compiled CSS `.w-full` sorts *after* the numeric widths — so a `w-24` passed via className silently loses and the control goes full-width (this once collapsed the exercise select to its chevron). Narrow overrides must use the important form: `!w-24`.

For visual verification there's `playwright-core` in devDependencies — it drives the system Edge (`chromium.launch({ channel: 'msedge' })`), no browser download needed. Signups need their email confirmed manually in `auth.users` (confirmation emails are on and rate-limited).

## Mobile app (`mobile/`)

Expo **SDK 52** (pinned — user's choice; use `npx expo install` for native deps) Android run recorder; own `package.json`, no workspaces. Same Supabase project/auth/RLS — it inserts ordinary `sessions` + `cardio_details` rows; zero web changes. Commands (from `mobile/`): `npm run typecheck`, `npm test` (vitest — pure modules in `src/lib/geo/` + `src/lib/format.ts` follow the same test-first culture), `npx eas-cli build -p android --profile preview` (standalone APK) or `development` (dev client; background GPS never works in Expo Go). EAS project `@jose_cisternas/momentum-mobile`; env lives in `mobile/.env` (git-ignored) AND `eas.json` env blocks (anon key is publishable by design).

Invariants (see `mobile/README.md` for the full list): `index.ts` imports `src/tracking/locationTask.ts` first (headless launches); run date captured at START via `todayLocalISO()`, never at upload; upload idempotent — `sessions.id` is a client UUID minted at `finish()` and persisted in the run snapshot (`run_snapshot` in AsyncStorage), unique violation = already uploaded; pause never stops the foreground service (ingest discards instead); snapshot writes are serialized (`flushSnapshot()` awaited at start/finish). Distance-filter thresholds in `DEFAULT_FILTER` are calibration knobs; the rules' semantics are pinned by `distance.test.ts` incl. exact gate boundaries.

## Notes

- The user may have `[demo]`-tagged seed sessions in the dev database (identifiable via `notes like '[demo]%'`); delete only those when asked to clean up demo data.
