-- Momentum initial schema
-- sessions: one row per training session, any sport, with the unified
-- session-RPE load (Foster) as a generated column so it can never drift
-- from rpe * duration.

create type public.sport as enum ('strength', 'run', 'swim');

-- Reference table for strength exercises.
-- user_id null = global seed exercise visible to everyone;
-- user_id set = custom exercise owned by that user.
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (name = btrim(name) and char_length(name) between 1 and 80),
  created_at timestamptz not null default now()
);

-- Case-insensitive uniqueness; nulls not distinct so global seeds
-- (user_id null) can't be duplicated either.
create unique index exercises_user_name_key
  on public.exercises (user_id, lower(name)) nulls not distinct;

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  sport public.sport not null,
  date date not null,
  duration_min numeric(5, 1) not null check (duration_min > 0 and duration_min <= 1440),
  rpe numeric(3, 1) not null check (rpe >= 0 and rpe <= 10),
  unified_load numeric(7, 2) generated always as (duration_min * rpe) stored,
  notes text check (notes is null or char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create table public.strength_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  -- Deferred (not RESTRICT) so deleting an auth.users row doesn't race:
  -- the exercises cascade may fire before the sessions -> strength_sets
  -- cascade has cleared this table; the check must wait until commit.
  exercise_id uuid not null references public.exercises (id)
    on delete no action deferrable initially deferred,
  weight_kg numeric(6, 2) not null check (weight_kg >= 0 and weight_kg <= 1000),
  reps int not null check (reps > 0 and reps <= 100),
  set_order int not null default 1 check (set_order > 0),
  unique (session_id, exercise_id, set_order)
);

-- One row per run/swim session; pace is derived in the app, never stored.
create table public.cardio_details (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  distance_m int not null check (distance_m > 0 and distance_m <= 1000000)
);

-- Detail rows must match the parent session's sport, and a session's sport
-- is frozen once detail rows exist. CHECK constraints can't look across
-- tables, so these are triggers.
create or replace function public.enforce_strength_session_sport()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions
    where id = new.session_id and sport = 'strength'
  ) then
    raise exception 'strength_sets.session_id must reference a sport = strength session';
  end if;
  return new;
end $$;

create trigger strength_sets_sport_check
  before insert or update of session_id on public.strength_sets
  for each row execute function public.enforce_strength_session_sport();

create or replace function public.enforce_cardio_session_sport()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions
    where id = new.session_id and sport in ('run', 'swim')
  ) then
    raise exception 'cardio_details.session_id must reference a run/swim session';
  end if;
  return new;
end $$;

create trigger cardio_details_sport_check
  before insert or update of session_id on public.cardio_details
  for each row execute function public.enforce_cardio_session_sport();

create or replace function public.prevent_sport_change_with_details()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sport <> old.sport and (
    exists (select 1 from public.strength_sets where session_id = old.id)
    or exists (select 1 from public.cardio_details where session_id = old.id)
  ) then
    raise exception 'cannot change sport on a session that already has detail rows';
  end if;
  return new;
end $$;

create trigger sessions_sport_immutable
  before update of sport on public.sessions
  for each row execute function public.prevent_sport_change_with_details();

-- Indexes for the hot paths:
-- rolling-window ACWR queries scan (user_id, date) ranges;
-- 1RM history joins strength_sets -> sessions per exercise.
create index sessions_user_date_idx on public.sessions (user_id, date);
create index strength_sets_session_idx on public.strength_sets (session_id);
create index strength_sets_exercise_idx on public.strength_sets (exercise_id, session_id);

-- Least privilege: no anonymous access at all; authenticated gets DML only
-- (Supabase's defaults grant ALL, including TRUNCATE, to anon + authenticated).
revoke all on public.exercises, public.sessions, public.strength_sets, public.cardio_details
  from anon, authenticated;
grant select, insert, update, delete
  on public.exercises, public.sessions, public.strength_sets, public.cardio_details
  to authenticated;

-- Row Level Security
alter table public.exercises enable row level security;
alter table public.sessions enable row level security;
alter table public.strength_sets enable row level security;
alter table public.cardio_details enable row level security;

-- exercises: everyone reads global (user_id is null) + their own; write only own.
create policy exercises_select on public.exercises
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));

create policy exercises_insert on public.exercises
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy exercises_update on public.exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy exercises_delete on public.exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- sessions: full CRUD on own rows only.
create policy sessions_select on public.sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy sessions_insert on public.sessions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy sessions_update on public.sessions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy sessions_delete on public.sessions
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- Child tables: ownership flows through the parent session.
create policy strength_sets_all on public.strength_sets
  for all to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = public.strength_sets.session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = public.strength_sets.session_id
        and s.user_id = (select auth.uid())
    )
  );

create policy cardio_details_all on public.cardio_details
  for all to authenticated
  using (
    exists (
      select 1 from public.sessions s
      where s.id = public.cardio_details.session_id
        and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.sessions s
      where s.id = public.cardio_details.session_id
        and s.user_id = (select auth.uid())
    )
  );

-- Seed global exercises (user_id null -> visible to all users).
insert into public.exercises (name) values
  ('Squat'),
  ('Bench Press'),
  ('Deadlift'),
  ('Overhead Press'),
  ('Barbell Row'),
  ('Pull-Up'),
  ('Romanian Deadlift'),
  ('Incline Bench Press'),
  ('Front Squat'),
  ('Hip Thrust');
