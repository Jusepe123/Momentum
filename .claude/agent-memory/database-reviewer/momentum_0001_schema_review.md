---
name: momentum-0001-schema-review
description: Pre-apply review findings for supabase/migrations/0001_initial_schema.sql (Momentum training tracker) — status as of 2026-07-03, migration not yet applied
metadata:
  type: project
---

Momentum's initial schema (`supabase/migrations/0001_initial_schema.sql`) was reviewed pre-apply on 2026-07-03. It had NOT been applied to any Supabase instance at review time (no live DB, no MCP connection available — review was static/read-only).

Key unresolved finding (CRITICAL) as of this review: `strength_sets.exercise_id` uses `on delete restrict` while both `sessions.user_id` and `exercises.user_id` cascade from `auth.users`. Deleting a user whose custom exercise has logged sets can hit a FK-violation on account deletion, because Postgres does not guarantee the sibling cascade (auth.users -> sessions -> strength_sets) completes before the auth.users -> exercises cascade attempts to delete the now-still-referenced exercise row. Recommended fix: change that FK to `on delete no action deferrable initially deferred` (RESTRICT cannot be deferred) so the check runs at commit time, after the sibling cascade has already cleared the referencing strength_sets rows.

Other notable findings (see full report in conversation, not persisted here): redundant `exercises_user_idx` (already covered by the leading column of the `unique nulls not distinct (user_id, name)` index), no explicit least-privilege GRANT/REVOKE statements (relies on Supabase's default ALL-privilege grants to anon/authenticated), no DB-level guard that `strength_sets` only attaches to `sport='strength'` sessions and `cardio_details` only to `run|swim` sessions, and `exercises.name` uniqueness not normalized for case/whitespace.

RLS itself was verified sound: users cannot attach strength_sets/cardio_details to another user's session, cannot modify/delete global (`user_id is null`) exercises, and the seed INSERT works because Supabase migrations run as table owner (RLS bypassed, `force row level security` not set).

**Why:** Recorded so a follow-up review of this migration (or a fix-up migration) can verify whether the CRITICAL FK-ordering issue and the GRANT hardening were actually addressed, rather than re-deriving the whole analysis from scratch.

**How to apply:** When reviewing a later migration that touches `exercises`, `sessions`, `strength_sets`, or `cardio_details`, check whether the FK on `strength_sets.exercise_id` was changed to deferrable NO ACTION and whether explicit GRANT/REVOKE statements were added. If not yet fixed, keep flagging as CRITICAL/HIGH respectively.
