-- Task 3.1: browser roles may read authorized rows; only service_role writes.
alter table public.users enable row level security;
alter table public.pot_meta enable row level security;
alter table public.pot_invites enable row level security;
alter table public.pot_events enable row level security;
alter table public.pots enable row level security;
alter table public.pot_members enable row level security;

-- Not exposed through the Data API. Definer privileges break the pots <->
-- pot_members RLS cycle. Identity always comes from auth.uid(), never an input.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create function private.can_read_pot(target_pot_id numeric)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.pots p
    where p.pot_id = target_pot_id
      and (
        lower(p.organizer_address) = lower((
          select u.wallet_address from public.users u where u.auth_user_id = auth.uid()
        ))
        or exists (
          select 1 from public.pot_members m
          where m.pot_id = p.pot_id and m.active
            and lower(m.address) = lower((
              select u.wallet_address from public.users u where u.auth_user_id = auth.uid()
            ))
        )
      )
  );
$$;

revoke all on function private.can_read_pot(numeric) from public, anon;
grant execute on function private.can_read_pot(numeric) to authenticated, service_role;

create policy users_select_own on public.users
  for select to authenticated
  using (auth_user_id = (select auth.uid()));

create policy pots_select_participant on public.pots
  for select to authenticated using (private.can_read_pot(pot_id));
create policy pot_meta_select_participant on public.pot_meta
  for select to authenticated using (private.can_read_pot(pot_id));
create policy pot_members_select_participant on public.pot_members
  for select to authenticated using (private.can_read_pot(pot_id));
create policy pot_invites_select_participant on public.pot_invites
  for select to authenticated using (private.can_read_pot(pot_id));
create policy pot_events_select_participant on public.pot_events
  for select to authenticated using (private.can_read_pot(pot_id));

-- Explicit grants work with both legacy and restricted Supabase defaults.
-- No insert/update/delete policies exist for either browser role.
revoke all on table public.users, public.pot_meta, public.pot_invites,
  public.pot_events, public.pots, public.pot_members, public.pot_status
  from public, anon, authenticated;
grant select on table public.users, public.pot_meta, public.pot_invites,
  public.pot_events, public.pots, public.pot_members, public.pot_status
  to authenticated;
grant all on table public.users, public.pot_meta, public.pot_invites,
  public.pot_events, public.pots, public.pot_members to service_role;
grant select on public.pot_status to service_role;
revoke all on sequence public.pot_events_id_seq from public, anon, authenticated;
grant usage, select on sequence public.pot_events_id_seq to service_role;

-- Supabase normally creates this publication; also support a fresh database.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end;
$$;

alter publication supabase_realtime add table public.pots, public.pot_members;
