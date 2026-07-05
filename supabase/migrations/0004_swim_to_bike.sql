-- Replace swimming with cycling across the domain.
--
-- The product no longer tracks swims; it tracks bike rides (GPS distance,
-- like runs). Rather than add a new enum value and migrate rows, we rename
-- the existing 'swim' value in place: ALTER TYPE ... RENAME VALUE is atomic,
-- rewrites no table data, and automatically carries every existing
-- sessions.sport = 'swim' row over to 'bike' (the enum value's identity is
-- its pg_enum OID, not the label, so stored rows need no rewrite). The only
-- current swim rows are [demo] seeds, which are purged separately after this.
--
-- Bike is a cardio sport: it stores cardio_details (distance_m) exactly like
-- run. The only other place the literal 'swim' appears is the cardio
-- sport-guard trigger, updated below. replace_session_details (0002) branches
-- on sport = 'strength' vs. an else that covers all cardio sports, so the
-- rename flows through it unchanged.

alter type public.sport rename value 'swim' to 'bike';

-- The cardio detail rows must reference a run/bike session (was run/swim).
create or replace function public.enforce_cardio_session_sport()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.sessions
    where id = new.session_id and sport in ('run', 'bike')
  ) then
    raise exception 'cardio_details.session_id must reference a run/bike session';
  end if;
  return new;
end $$;
