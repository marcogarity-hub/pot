-- Display names: members pick a name that other members see instead of their email.
-- Additive: one nullable column, one lookup function, and a replaced pot_status view.

alter table public.users
  add column display_name text
  check (display_name is null or char_length(display_name) between 1 and 40);

-- Names live on public.users, which a member can read only for their own row. This definer function lets the
-- pot_status view return a co-member's name. It is reached only through the view, which already limits rows
-- to pots the caller can read, and it returns the name and nothing else.
create function private.member_name(p_address text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select u.display_name
  from public.users u
  where lower(u.wallet_address) = lower(p_address)
  limit 1
$$;

revoke all on function private.member_name(text) from public, anon;
grant execute on function private.member_name(text) to authenticated, service_role;

-- Same columns as before; only the members JSON changes. It gains "name", and "email" is now returned only to the
-- organizer of the pot (who typed the invites) and to the member it belongs to. Other members get null.
create or replace view public.pot_status with (security_invoker = true) as
select
  p.*,
  meta.title,
  meta.invite_token,
  meta.receipt_text,
  meta.created_at,
  lower(p.organizer_address) = lower((
    select u.wallet_address from public.users u where u.auth_user_id = auth.uid()
  )) as is_organizer,
  coalesce((
    select jsonb_agg(jsonb_build_object(
      'address', m.address,
      'email', case
        when lower(m.address) = lower(me.wallet_address)
          or lower(p.organizer_address) = lower(me.wallet_address)
        then i.email::text
        else null
      end,
      'name', private.member_name(m.address),
      'has_paid', m.has_paid,
      'has_objected', m.has_objected,
      'has_refunded', m.has_refunded,
      'active', m.active,
      'is_organizer', lower(m.address) = lower(p.organizer_address)
    ) order by m.address)
    from public.pot_members m
    left join public.pot_invites i
      on i.pot_id = m.pot_id and lower(i.address) = lower(m.address)
    left join (
      select u.wallet_address from public.users u where u.auth_user_id = auth.uid()
    ) me on true
    where m.pot_id = p.pot_id
  ), '[]'::jsonb) as members
from public.pots p
left join public.pot_meta meta on meta.pot_id = p.pot_id;
