-- Momentum routines: reusable strength templates ("Push day" = bench 4x8,
-- OHP 3x10, ...). Logging a session starts from a routine and prefills the
-- set rows; weight_kg is a nullable target so a routine can be defined by
-- exercises + reps alone.

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness per user.
create unique index routines_user_name_key
  on public.routines (user_id, lower(name));

create table public.routine_sets (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  -- Deferred (not RESTRICT) for the same reason as strength_sets: deleting an
  -- auth.users row cascades through exercises and routines in arbitrary
  -- order; the check must wait until commit.
  exercise_id uuid not null references public.exercises (id)
    on delete no action deferrable initially deferred,
  weight_kg numeric(6, 2) check (weight_kg is null or (weight_kg >= 0 and weight_kg <= 1000)),
  reps int not null check (reps > 0 and reps <= 100),
  set_order int not null default 1 check (set_order > 0),
  unique (routine_id, set_order)
);

-- unique (routine_id, set_order) already indexes routine_id lookups;
-- exercise_id needs its own index for exercise-delete FK checks.
create index routine_sets_exercise_idx on public.routine_sets (exercise_id);

-- Least privilege: mirror 0001 — no anonymous access, DML only.
revoke all on public.routines, public.routine_sets from anon, authenticated;
grant select, insert, update, delete on public.routines, public.routine_sets to authenticated;

alter table public.routines enable row level security;
alter table public.routine_sets enable row level security;

-- routines: full CRUD on own rows only.
create policy routines_select on public.routines
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy routines_insert on public.routines
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy routines_update on public.routines
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy routines_delete on public.routines
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- routine_sets: ownership flows through the parent routine.
create policy routine_sets_all on public.routine_sets
  for all to authenticated
  using (
    exists (
      select 1 from public.routines r
      where r.id = public.routine_sets.routine_id
        and r.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.routines r
      where r.id = public.routine_sets.routine_id
        and r.user_id = (select auth.uid())
    )
  );

-- Atomic set replacement for edits, mirroring replace_session_details (0002):
-- delete + reinsert inside one transaction so a failed edit can't wipe a
-- routine's existing sets.
create or replace function public.replace_routine_sets(
  p_routine_id uuid,
  p_sets jsonb default '[]'::jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.routines
    where id = p_routine_id and user_id = (select auth.uid())
  ) then
    raise exception 'routine % not found or not owned by caller', p_routine_id;
  end if;

  if jsonb_array_length(coalesce(p_sets, '[]'::jsonb)) > 200 then
    raise exception 'too many sets (max 200)';
  end if;

  -- FK checks bypass RLS, so validate visibility ourselves: every referenced
  -- exercise must be a global seed or owned by the caller. Otherwise a
  -- cross-user exercise_id would only surface at commit via the deferred FK.
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

  delete from public.routine_sets where routine_id = p_routine_id;

  insert into public.routine_sets (routine_id, exercise_id, weight_kg, reps, set_order)
  select
    p_routine_id,
    (elem ->> 'exercise_id')::uuid,
    (elem ->> 'weight_kg')::numeric,
    (elem ->> 'reps')::int,
    ord::int
  from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) with ordinality as t(elem, ord);
end $$;

revoke execute on function public.replace_routine_sets(uuid, jsonb) from public, anon;
grant execute on function public.replace_routine_sets(uuid, jsonb) to authenticated;
