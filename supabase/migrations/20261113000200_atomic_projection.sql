-- A projection spans parent/member rows and must survive concurrent deliveries.
-- The caller folds a complete append-only history; reject stale snapshots so
-- QuickNode retries rather than allowing a slower handler to regress state.
create function public.apply_pot_projection(
  p_pot jsonb,
  p_members jsonb,
  p_event_count bigint
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  projected public.pots;
  actual_count bigint;
begin
  projected := jsonb_populate_record(null::public.pots, p_pot);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(projected.pot_id::text, 0));
  select count(*) into actual_count from public.pot_events where pot_id = projected.pot_id;
  if actual_count <> p_event_count then
    raise exception 'stale projection; reload events and retry';
  end if;
  if exists (
    select 1 from jsonb_populate_recordset(null::public.pot_members, p_members) m
    where m.pot_id is distinct from projected.pot_id
  ) then
    raise exception 'mixed pot members';
  end if;

  insert into public.pots select (projected).* where true
  on conflict (pot_id) do update set
    organizer_address = excluded.organizer_address,
    total = excluded.total, share = excluded.share, deadline = excluded.deadline,
    threshold = excluded.threshold,
    objection_window_seconds = excluded.objection_window_seconds,
    request_window_seconds = excluded.request_window_seconds,
    locked_at = excluded.locked_at, state = excluded.state,
    payments_count = excluded.payments_count, objections_count = excluded.objections_count,
    receipt_hash = excluded.receipt_hash, release_eligible_at = excluded.release_eligible_at,
    updated_at = excluded.updated_at;

  insert into public.pot_members
    select * from jsonb_populate_recordset(null::public.pot_members, p_members) where true
  on conflict (pot_id, address) do update set
    has_paid = excluded.has_paid, has_objected = excluded.has_objected,
    has_refunded = excluded.has_refunded, active = excluded.active;
end;
$$;
revoke all on function public.apply_pot_projection(jsonb, jsonb, bigint) from public, anon, authenticated;
grant execute on function public.apply_pot_projection(jsonb, jsonb, bigint) to service_role;
