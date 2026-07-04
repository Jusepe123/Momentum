---
name: momentum-0003-routines-review
description: Pre-apply static review findings for supabase/migrations/0003_routines.sql (routines/routine_sets + replace_routine_sets RPC) — status as of 2026-07-04, migration not yet applied, no live-DB connection used
metadata:
  type: project
---

Reviewed `supabase/migrations/0003_routines.sql` statically (file-only, no live DB connection) on 2026-07-04, against conventions from [[momentum_0001_schema_review]] and [[momentum_0002_replace_session_details_review]].

**Good news first — prior feedback was applied correctly:** `routine_sets.exercise_id` FK was written as `on delete no action deferrable initially deferred` from the start (the exact fix recommended as CRITICAL for `strength_sets.exercise_id` in the 0001 review), with a comment explicitly citing the same auth.users cascade-diamond reasoning. `routine_id` FK correctly stays plain `on delete cascade` (no diamond risk there — single parent/child pair). Grants mirror 0001's least-privilege pattern exactly (`revoke all ... from anon, authenticated` then explicit `grant select/insert/update/delete ... to authenticated`). RLS on `routine_sets` derives ownership through `routines` via `EXISTS`, same shape as `strength_sets_all`/`cardio_details_all` in 0001, and correctly uses `(select auth.uid())` everywhere (no bare calls). `replace_routine_sets` RPC: SECURITY INVOKER, `search_path=''`, upfront ownership check with `raise exception ... if not found`, and a 200-set cap — all three gaps flagged as MEDIUM in the 0002 review were pre-empted here on the first draft.

**MEDIUM finding (new, escalated from a pre-existing LOW):** `routine_sets.exercise_id` (like `strength_sets.exercise_id` since 0001) is validated only by the FK, which bypasses RLS on `exercises` — a set can reference another user's *private* custom exercise if its UUID is ever known (API bug, log leak, guessed). The 0002 review flagged this as LOW purely as a data-visibility concern. Duplicating the same unchecked FK into a second child table (`routine_sets`) doubles the surface, and combined with the deferred-FK delete-diamond design, the consequence is worse than previously noted: if such a cross-user reference ever exists, deleting the *exercise owner's* auth.users row will cascade-delete the exercise, but the deferred FK check at commit will find the referencing row in the *other* user's `routine_sets` (or `strength_sets`) still present — that row is not part of the deleting user's cascade — so the whole account-deletion transaction fails at commit with an FK violation, with no obvious cause from the error alone. Fix: add an ownership/visibility check for every `exercise_id` in `p_sets` inside `replace_routine_sets` (and note this equally applies to whatever code path inserts into `strength_sets`), e.g.:
```sql
if exists (
  select 1
  from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) as t(elem)
  where not exists (
    select 1 from public.exercises ex
    where ex.id = (t.elem ->> 'exercise_id')::uuid
      and (ex.user_id is null or ex.user_id = (select auth.uid()))
  )
) then
  raise exception 'one or more exercises not found or not accessible';
end if;
```

**LOW / informational:** PKs continue to use `gen_random_uuid()` (UUIDv4) rather than UUIDv7 — pre-existing convention from 0001, consistently extended here, not a new defect but worth reconsidering project-wide if write-heavy/distributed-index concerns ever arise. `routine_sets_exercise_idx` is a single-column index on `exercise_id` (vs. 0001's composite `(exercise_id, session_id)` on `strength_sets`) — correct as-is since there's no analogous "history lookup by exercise" query for routines yet, just FK-delete-check support.

**No CRITICAL or HIGH found.** This migration is materially cleaner than 0001/0002 were on first pass — treat it as the new baseline example of "what applying prior review feedback looks like" for this project.

**Why:** So a follow-up review (of a 0003 fix-up migration, or the next migration touching `exercises`/`routine_sets`/`strength_sets`) can check whether the exercise-ownership validation was added, rather than re-deriving this analysis. Also documents that the deferred-FK diamond fix and RPC hardening patterns from 0001/0002 reviews are now established, working conventions in this codebase.

**How to apply:** When reviewing any future migration that inserts into `strength_sets` or `routine_sets` (or adds a third such child table), check whether `exercise_id` ownership/visibility validation was added. If still absent, keep flagging as MEDIUM — and consider escalating to HIGH if a concrete account-deletion failure is ever reproduced.
