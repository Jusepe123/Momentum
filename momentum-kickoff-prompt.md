# KICKOFF PROMPT FOR CLAUDE CODE — "Momentum" training tracker

Paste this into a fresh Claude Code session opened in an empty project directory. Follow my global CLAUDE.md rules throughout (verify before claiming done, minimal surgical edits, adapt to the stack, root-cause debugging).

## What we're building
**Momentum** — a personal training tracker for strength, running, and swimming that (1) motivates me by *visualizing my gains* over time, and (2) helps me train smart by monitoring training load to avoid overtraining/injury.

The core design idea: **every session, regardless of sport, produces a single unified "load" value**, so injury-risk math works across all sports. On top of that shared load, each sport has its own progress metric.

## Unified load model (the backbone)
- **Session load = session-RPE method = RPE (0–10) × duration (minutes).** This applies to ALL sports (Foster's method). It's the common denominator that makes cross-sport load tracking possible.
- Strength sessions ALSO record a **volume-load** (Σ sets × reps × weight) as a strength-specific stat, but the *unified* load is still session-RPE so it's comparable to a swim or a run.

## Sport-specific progress metrics
- **Strength:** estimated 1RM per exercise. Use Epley: `1RM = weight × (1 + reps/30)` and Brzycki: `1RM = weight × 36 / (37 − reps)`. Track best estimated 1RM per exercise over time; detect plateaus (no improvement over N weeks).
- **Running:** pace (min/km), distance, and a race-time prediction using Riegel: `T2 = T1 × (D2/D1)^1.06`.
- **Swimming:** pace per 100m, distance, volume.

## Injury-risk metric (cross-sport, the smart-training feature)
- **ACWR (Acute:Chronic Workload Ratio)** computed from the unified load:
  - Acute load = rolling sum of session-RPE load over the last 7 days.
  - Chronic load = average weekly load over the last 28 days (rolling).
  - ACWR = acute / chronic.
  - Risk zones: **sweet spot 0.8–1.3** (green), **1.3–1.5** caution (yellow), **> 1.5** high risk (red), **< 0.8** undertraining.
- These rolling-window calculations are the trickiest logic in the app (off-by-one on date windows is the classic bug) — implement them test-first.

## Stack
React + Vite + TypeScript, Tailwind CSS, React Query v5, Zustand (UI state), Recharts (charts), Supabase (Postgres + Auth + Row Level Security).

## Build order (each phase exercises a specific part of my setup — respect this order)

**Phase 0 — Plan.** Before writing code, produce a short `plan.md` (3–6 steps with acceptance criteria) and show it to me for approval. Do not start coding until I confirm.

**Phase 1 — Data model FIRST.** Design the schema:
- `sessions` (id, user_id, sport enum[strength|run|swim], date, duration_min, rpe, unified_load computed, notes)
- polymorphic detail per sport: `strength_sets` (session_id, exercise, weight, reps), `cardio_details` (session_id, distance_m, pace) — or a cleaner design if you propose one.
- `exercises` reference table for strength.
- RLS on every user-owned table using `(SELECT auth.uid())`, not bare `auth.uid()`.
- Indexes for the rolling-window queries (user_id, date) and for per-exercise 1RM history.
**Before applying ANY migration, invoke the `database-reviewer` agent to review the schema** (types, RLS, indexes, N+1 on the ACWR aggregation). Apply migrations only after the review passes. The db-guard hook will sit in front of destructive SQL — expect it.

**Phase 2 — Pure scoring functions, test-first.** Implement and unit-test as pure functions with no I/O: `sessionLoad()`, `estimate1RM()` (both formulas), `riegelPredict()`, `acwr()` with the rolling windows, `paceFrom()`. Write failing tests first, then implement, then confirm green. This is where my "evidence-before-claim" rule applies — show me the passing test output.

**Phase 3 — Auth + session CRUD.** Supabase Auth, then create/list/edit sessions with **simple manual entry** for all three sports (no file import). Manual forms: pick sport → enter duration + RPE + sport-specific fields. Run the `code-reviewer` agent before the first commit.

**Phase 4 — Dashboard (the "visualize my gains" payoff).** Three layers:
1. **Load trend** over time with the healthy ACWR band (0.8–1.3) shaded, and today's risk light (green/yellow/red).
2. **Progress curves** per metric: estimated 1RM per lift rising over months; running/swim pace improving.
3. **Personal records**, celebrated when broken.
Apply the `frontend-design` skill here: intentional typography, a restrained palette with one accent, good numeric/data display, dark mode that isn't pure black, designed empty/loading states. It must NOT look like a default AI-generated app.

**Phase 5 (optional) — Methodology writeup.** Using the `academic-latex` skill, generate a short LaTeX doc explaining the unified session-RPE load, ACWR, and the 1RM/Riegel formulas, as technical documentation.

## Guardrails
- Verify each phase before declaring it done (build + tests + observed behavior).
- Never point Supabase MCP at production data; use a dev project. Never run destructive SQL without asking me.
- Keep secrets out of code and commits.
- I'm experienced with React Native/TypeScript but this is a web (Vite) stack — flag anything web-specific I should know as we go.

Start with Phase 0: show me the plan and wait for my approval.
