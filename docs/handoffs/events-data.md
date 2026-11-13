# Handoffs: events-data lane

## Task 3.1 — Schema, RLS, Realtime (2026-11-12)

Done: implemented only Task 3.1. Six tables, the `pot_status` view, SELECT-only
browser RLS, service-role write grants, and Realtime publication membership for
`pots` and `pot_members`. Enabled `citext`. Wallet/address columns must be stored
lowercase; comparisons use `lower()`. Emails must be lowercase and trimmed.
`users` follows amendment A6, retaining the wallet mapping on auth deletion.
The fixed-search-path SECURITY DEFINER helper `private.can_read_pot(numeric)`
resolves identity through `users.auth_user_id = auth.uid()` and checks the
organizer wallet or an active member wallet without recursive RLS. Former
members remain visible in an authorized participant's member list, but an
inactive member alone no longer grants read access. `pot_status` uses
`security_invoker = true` so its reads obey the underlying RLS.

Files changed:
- `supabase/migrations/20261113000000_init.sql`
- `supabase/migrations/20261113000100_rls_realtime.sql`
- `docs/handoffs/events-data.md`

Test results:

`supabase db push --linked --dry-run` — exit 0; exactly these two pending migrations:

```text
Initialising login role...
DRY RUN: migrations will *not* be pushed to the database.
Connecting to remote database...
Skipping migration .gitkeep... (file name must match pattern "<timestamp>_name.sql")
Would push these migrations:
Finished supabase db push.
 • 20261113000000_init.sql
 • 20261113000100_rls_realtime.sql
A new version of Supabase CLI is available: v3.1.0 (currently installed v2.107.0)
We recommend updating regularly for new features and bug fixes: https://supabase.com/docs/guides/cli/getting-started#updating-the-supabase-cli
```

The initial sandbox attempt exited 1 before connecting because the CLI could not
write `/Users/marcogarity/.supabase/telemetry.json.tmp.1794542503979` (EPERM).
The retry with sandbox escalation succeeded, including network access.
`git diff --check` passed. No migrations were applied to the linked database;
the dry-run checks the pending migration list, not SQL execution or RLS behavior.

Blockers: none for Task 3.1's requested dry-run. The conductor still needs to run
the real push and `supabase db lint --linked --fail-on error`. Tasks 3.2+ and
TypeScript were not started.

Interfaces for Lane 2 and Lane 4 (all tables/view in `public`):
- `users(id uuid, auth_user_id uuid nullable unique, email citext unique,
  circle_wallet_id text nullable, wallet_address text nullable unique,
  claimed boolean, created_at timestamptz)`. `id` defaults to
  `gen_random_uuid()`; `claimed` defaults to false. Link auth via `auth_user_id`,
  never by replacing the internal `id`.
- Lane 2 writes `pot_meta(pot_id numeric PK, title text, invite_token text unique,
  receipt_text text nullable, created_at timestamptz)` and
  `pot_invites(pot_id numeric, address text, email citext)` with conflict key
  `(pot_id, address)`. Store receipt text only after release-request confirmation
  (A12). Metadata has no foreign key to the chain tables so it survives replay
  and may arrive before the Stream projection.
- Future Streams work writes `pot_events(id bigserial PK, pot_id numeric,
  event_name text, transaction_hash text, log_index int, block_number numeric,
  args jsonb)` with unique `(transaction_hash, log_index)` and a fold-order index
  `(pot_id, block_number, log_index)`. `args` bigint values must be decimal
  strings; transaction hashes must be lowercase. `block_number` uses `numeric`
  rather than the plan's `bigint` per this task's explicit chain-value instruction.
- `pots(pot_id numeric PK, organizer_address text, total numeric, share numeric,
  deadline timestamptz, threshold int, objection_window_seconds int,
  request_window_seconds int, locked_at timestamptz nullable, state smallint,
  payments_count int, objections_count int, receipt_hash text nullable,
  release_eligible_at timestamptz nullable, updated_at timestamptz)`.
  State values: 0 Funding, 1 Locked, 2 PayoutRequested, 3 Released, 4 Frozen.
  Send `updated_at` when updating a projection; its `now()` default is for inserts.
- `pot_members(pot_id numeric, address text, has_paid boolean,
  has_objected boolean, has_refunded boolean, active boolean)` with conflict key
  `(pot_id, address)`. Flags default false; `active` defaults true. Insert the
  parent `pots` row first. `has_paid` is never cleared for refunds or objections.
- `pot_status` returns **one row per pot**: all `pots` columns plus `title`,
  `invite_token`, `receipt_text`, `created_at` from `pot_meta`, caller-relative
  `is_organizer`, and a JSONB `members` array ordered by address. Each member has
  `address`, `email`, `has_paid`, `has_objected`, `has_refunded`, `active`,
  `is_organizer` (member address compared to organizer). Missing metadata/email
  is null; no members yields `[]`. Lane 4 can fetch a single row by `pot_id`.
  Verify receipt text against `receipt_hash` before displaying it (A12).
- Subscribe to `postgres_changes` on `pots` and `pot_members`, filtered by
  `pot_id`, and refetch `pot_status`. Only those two tables are added to
  `supabase_realtime`. Browser roles have no write grants or write policies;
  server writers use the service role. Unauthenticated reads have no grants.

## Task 3.2 — Decode and fold (2026-11-12)

Done: injectable `decodePotLogs(payload, abi, potAddress)` and deterministic
`foldPot`, with exact decimal string chain values, lowercase addresses/hashes,
sorted/deduplicated histories, all ten event effects, and former-member history.
Missing creation history and removed logs fail rather than produce false state.
Files: `web/app/api/streams/{decode,fold,fold.test,test-support}.ts` and
`web/app/api/streams/__fixtures__/arc-logs.json`.

The fixture is **docs-derived synthetic data, not a live Arc capture**. It uses
QuickNode's EVM Logs JSON schema, `data[block][receipt][log]`, with encoded
PotCreated/Paid events from the plan's Task 1.2 signatures. Sources checked:
https://www.quicknode.com/docs/streams/data-sources/ethereum-evm
https://www.quicknode.com/docs/streams/data-sources
The decoder also accepts arrays flattened inside `data` by a filter.

TDD: first run failed resolving missing `./decode`; implementation then passed:
```text
$ cd web && npx vitest run app/api/streams/fold.test.ts
 Test Files  1 passed (1)
      Tests  6 passed (6)
```
Blockers: Lane 1 ABI is absent; tests define the minimal event ABI locally.
The plan's referenced Superpowers execution skills were not found in installed
skill directories; followed the explicit task-by-task TDD workflow directly.
Fetched origin/main and fast-forward check confirmed this branch already matched
main before implementation; no main worktree or branch was changed.
