-- Task 3.1: API-owned metadata is independent of the rebuildable projection.
create extension if not exists citext with schema public;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email public.citext unique not null,
  circle_wallet_id text,
  wallet_address text unique,
  claimed boolean not null default false,
  created_at timestamptz not null default now(),
  constraint users_wallet_lowercase check (wallet_address = lower(wallet_address)),
  constraint users_email_normalized check (email::text = lower(btrim(email::text)))
);

-- No foreign keys from metadata to projections: API writes and Streams may
-- arrive in either order, and replaying chain state must preserve metadata.
create table public.pot_meta (
  pot_id numeric primary key,
  title text not null,
  invite_token text unique not null,
  receipt_text text,
  created_at timestamptz not null default now()
);

create table public.pot_invites (
  pot_id numeric not null,
  address text not null check (address = lower(address)),
  email public.citext not null check (email::text = lower(btrim(email::text))),
  primary key (pot_id, address)
);

create table public.pot_events (
  id bigserial primary key,
  pot_id numeric not null,
  event_name text not null,
  transaction_hash text not null check (transaction_hash = lower(transaction_hash)),
  log_index int not null,
  -- Chain bigint values use numeric to avoid a signed bigint ceiling.
  block_number numeric not null,
  args jsonb not null,
  unique (transaction_hash, log_index)
);

comment on column public.pot_events.args is
  'Decoded event arguments; all chain bigint values are decimal strings in JSON.';

create index pot_events_fold_order on public.pot_events (pot_id, block_number, log_index);

create table public.pots (
  pot_id numeric primary key,
  organizer_address text not null check (organizer_address = lower(organizer_address)),
  total numeric not null,
  share numeric not null,
  deadline timestamptz not null,
  threshold int not null,
  objection_window_seconds int not null,
  request_window_seconds int not null,
  locked_at timestamptz,
  state smallint not null default 0 check (state between 0 and 4),
  payments_count int not null default 0,
  objections_count int not null default 0,
  receipt_hash text,
  release_eligible_at timestamptz,
  updated_at timestamptz not null default now()
);

create index pots_organizer_address on public.pots (lower(organizer_address));

create table public.pot_members (
  pot_id numeric not null references public.pots(pot_id) on delete cascade,
  address text not null check (address = lower(address)),
  has_paid boolean not null default false,
  has_objected boolean not null default false,
  has_refunded boolean not null default false,
  active boolean not null default true,
  primary key (pot_id, address)
);

create index pot_members_wallet on public.pot_members (lower(address), pot_id) where active;

-- One row per pot for usePot(). Keep former members in the array so the UI
-- can show seat-swap/refund history. Left joins tolerate delayed API metadata.
-- security_invoker ensures the view observes the underlying tables' RLS.
create view public.pot_status with (security_invoker = true) as
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
      'email', i.email,
      'has_paid', m.has_paid,
      'has_objected', m.has_objected,
      'has_refunded', m.has_refunded,
      'active', m.active,
      'is_organizer', lower(m.address) = lower(p.organizer_address)
    ) order by m.address)
    from public.pot_members m
    left join public.pot_invites i
      on i.pot_id = m.pot_id and lower(i.address) = lower(m.address)
    where m.pot_id = p.pot_id
  ), '[]'::jsonb) as members
from public.pots p
left join public.pot_meta meta on meta.pot_id = p.pot_id;
