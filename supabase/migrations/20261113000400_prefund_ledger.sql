create table public.prefund_ledger (
  day date primary key,
  spent numeric not null default 0
);

alter table public.prefund_ledger enable row level security;
revoke all on table public.prefund_ledger from public, anon, authenticated;
grant all on table public.prefund_ledger to service_role;

create or replace function public.reserve_prefund(p_amount numeric, p_cap numeric)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  today_utc date := (now() at time zone 'utc')::date;
  reserved boolean;
begin
  if p_amount is null or p_amount <= 0 or p_cap is null or p_cap < 0 then
    return false;
  end if;

  insert into public.prefund_ledger(day, spent)
  select today_utc, p_amount
  where p_amount <= p_cap
  on conflict (day) do update
  set spent = public.prefund_ledger.spent + excluded.spent
  where public.prefund_ledger.spent + excluded.spent <= p_cap
  returning true into reserved;

  return coalesce(reserved, false);
end;
$$;

create or replace function public.release_prefund(p_amount numeric)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  today_utc date := (now() at time zone 'utc')::date;
begin
  if p_amount is null or p_amount <= 0 then
    return;
  end if;

  update public.prefund_ledger
  set spent = greatest(spent - p_amount, 0)
  where day = today_utc;
end;
$$;

revoke all on function public.reserve_prefund(numeric, numeric) from public, anon, authenticated;
revoke all on function public.release_prefund(numeric) from public, anon, authenticated;
grant execute on function public.reserve_prefund(numeric, numeric) to service_role;
grant execute on function public.release_prefund(numeric) to service_role;
