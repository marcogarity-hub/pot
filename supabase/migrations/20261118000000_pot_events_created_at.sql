-- When Pot recorded each event, so History can show dates. Events written before this migration keep NULL
-- (their time was never stored); every new event gets now() at insert. This is when the stream delivered the
-- event, which is within seconds of the chain event, so show it as a day, never as an exact time.
alter table public.pot_events add column created_at timestamptz;
alter table public.pot_events alter column created_at set default now();

comment on column public.pot_events.created_at is
  'When Pot recorded the event (NULL for events recorded before 2026-11-18). Not the block time.';
