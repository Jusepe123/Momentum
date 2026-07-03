-- Atomically replace a session's detail rows (strength sets or cardio).
-- Fixes the non-atomic delete-then-insert in the client: if any insert
-- fails, the whole transaction rolls back and the original rows survive.
--
-- SECURITY INVOKER: RLS on strength_sets/cardio_details still applies, and
-- ownership is additionally checked upfront so a bogus/foreign session id
-- errors instead of silently no-opping. The function branches on the
-- session's sport so a cardio edit can never wipe distance data by omitting
-- p_distance_m, and a strength edit never touches cardio rows (and vice
-- versa). The sport-consistency triggers still fire inside the transaction.
create or replace function public.replace_session_details(
  p_session_id uuid,
  p_sets jsonb default '[]'::jsonb,
  p_distance_m integer default null
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_sport public.sport;
begin
  select sport into v_sport
  from public.sessions
  where id = p_session_id and user_id = (select auth.uid());
  if not found then
    raise exception 'session % not found or not owned by caller', p_session_id;
  end if;

  if jsonb_array_length(coalesce(p_sets, '[]'::jsonb)) > 200 then
    raise exception 'too many sets (max 200)';
  end if;

  if v_sport = 'strength' then
    delete from public.strength_sets where session_id = p_session_id;

    insert into public.strength_sets (session_id, exercise_id, weight_kg, reps, set_order)
    select
      p_session_id,
      (elem ->> 'exercise_id')::uuid,
      (elem ->> 'weight_kg')::numeric,
      (elem ->> 'reps')::integer,
      ord::integer
    from jsonb_array_elements(coalesce(p_sets, '[]'::jsonb)) with ordinality as t(elem, ord);
  else
    if p_distance_m is null then
      raise exception 'distance_m is required for a % session', v_sport;
    end if;

    delete from public.cardio_details where session_id = p_session_id;

    insert into public.cardio_details (session_id, distance_m)
    values (p_session_id, p_distance_m);
  end if;
end $$;

revoke execute on function public.replace_session_details(uuid, jsonb, integer) from public, anon;
grant execute on function public.replace_session_details(uuid, jsonb, integer) to authenticated;
