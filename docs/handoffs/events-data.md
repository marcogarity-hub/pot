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

## Task 3.3 — Streams webhook and stores (2026-11-12)

Done: HMAC-SHA256 over exact `nonce + timestamp + uncompressed body`, strict
hex digest validation and constant-time comparison; gzip decoding before
verification; authenticated decode, append-only event inserts, full-history
reload/fold, and projection writes. Duplicate deliveries still refold. Failed
projections return 500 so retries repair them; missing creation histories are
stored and return 500, converging once the creation batch arrives.

Files: `web/app/api/streams/{route,handler,verify,store,abi-placeholder}.ts`,
`route.test.ts`, and new migration
`supabase/migrations/20261113000200_atomic_projection.sql`. Small TypeScript
compatibility adjustments in `decode.ts`, `fold.ts`, and `test-support.ts`.
No merged migrations were edited.

**Apply the new migration before enabling the Stream.** It is needed to write
parent/member projections atomically and serialize concurrent projection writers
with a per-pot transaction advisory lock. A stored-event-count check rejects
stale folds, making slower deliveries retry rather than overwrite newer state.
The RPC is executable only by service_role. Event reloads page in append-only id
order to avoid the API row limit and page shifts during out-of-order backfill;
`foldPot` then sorts by block/log. Numeric IDs and block numbers are selected
with `::text` to avoid JSON number rounding. RPC execution itself has not been
tested against a database or applied; Supabase tests are fully mocked as requested.

QuickNode verification source checked before implementation:
https://www.quicknode.com/guides/quicknode-products/streams/validating-incoming-streams-webhook-messages
No freshness window is imposed, so authenticated historical/retried deliveries
remain usable; event identity makes replay idempotent.

Integration gate: `route.ts` imports an intentionally empty `potAbi` from our
`abi-placeholder.ts`. **Swap that import to Lane 1's generated `@/lib/pot/abi`
when available**, verify the exact signatures/indexing, and remove the placeholder.
Until then POST returns 503 and cannot silently acknowledge undecoded events.
It uses existing env names `QUICKNODE_STREAM_TOKEN` and
`NEXT_PUBLIC_POT_ADDRESS`. Admin client is `@/lib/supabase/admin` as requested.
No Stream was created, and no keys or settings were changed.

TDD: initial route suite failed on missing `./handler`; implementation passed:
```text
$ cd web && npx vitest run app/api/streams
 Test Files  2 passed (2)
      Tests  16 passed (16)
$ cd web && npx next typegen && npx tsc --noEmit
Generating route types...
✓ Types generated successfully
```
TypeScript exit 0. `next typegen` generated ignored framework types needed by the
existing layout's global `LayoutProps`; no shared source/config was modified.
Existing Vite config-loader warning remains (conductor-owned config).

## Task 3.4 Steps 1–4 — Realtime hook (2026-11-12)

Done: `usePot(potId)` exports `{ status, loading, refetch }` and `PotStatusRow`.
It registers both `pots` and `pot_members` subscriptions before its initial fetch,
refetches on every change and SUBSCRIBED notification (including reconnect), and
removes the channel on cleanup. Serialized reads queue invalidations rather than
letting an old initial response overwrite newer state. A separate regression test
covers a change queued between a read's completion and its cleanup. Changing
potId or unmounting discards old in-flight results. Numeric pot/amount columns
are selected as text. `refetch` is stable and awaitable; failed reads retain the
last successful status and end loading, and subsequent refetches can recover.
The specified hook interface has no error field, so errors are not exposed.

Files changed: `web/lib/realtime/usePot.ts` and `usePot.test.tsx`.
Lane 4 can import `usePot`, `PotStatusRow`, `PotRow`, and `MemberRow` from
`@/lib/realtime/usePot`. Status mirrors the existing `pot_status` view, including
nullable offchain metadata and the member JSON array. Use `has_paid` independently
of `has_refunded`; former members remain in the array with `active=false`.
Receipt-text verification remains the UI lane's responsibility (A12).

TDD evidence: the first hook run failed resolving missing `./usePot`. After
implementation, a new completion-race test failed (`expected +0 to be 3`), then
passed after preserving the queued invalidation in promise cleanup.

Final validation (no network in tests; both Supabase clients mocked):
```text
$ cd web && npx vitest run app/api/streams lib/realtime
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.1.0 /Users/marcogarity/code/pot-events-data/web


 Test Files  3 passed (3)
      Tests  22 passed (22)
   Start at  23:15:25
   Duration  767ms (environment 54%, import 18%, tests 13%, setup 13%, transform 2%)

$ cd web && npx tsc --noEmit
(no output; exit 0)

$ git diff --check
(no output; exit 0)
```

Remaining conductor work: apply and validate the new atomic-projection migration;
swap the route's ABI-placeholder import after Lane 1 lands the actual ABI; set the
existing Stream-token/address env values; then create/configure the Stream after
deploy. **Task 3.4 Steps 5–7 were intentionally not performed.** No QuickNode
Stream was created, no live Paid-to-browser check was attempted, and the fixture
remains docs-derived. Replace it with a real capture during that later live check.
The live Lane 3 done-when remains pending with the conductor. No merge or push.

## Conductor review round 1 (2026-11-12)

Done: removed the synchronous effect state reset in `usePot`; its return value
continues to derive null status/loading for a changed potId. Limited raw webhook
bodies and gzip output to 5 * 1024 * 1024 bytes. Oversized raw bodies return 413
before decompression; `ERR_BUFFER_TOO_LARGE` from bounded gunzip returns 413.
Other malformed bodies retain their existing 400 behavior.

Files changed: `web/lib/realtime/usePot.ts`,
`web/app/api/streams/handler.ts`, `web/app/api/streams/route.test.ts`, and this handoff.
One added regression test covers both raw and gzip-expanded oversized bodies and
checks that neither stores events. TDD: it first failed with `expected 400 to be
413`, then passed after the size limits were implemented. All usePot tests remain
green. No other implementation changes, merges, or pushes.

Validation output (combined command exit 0; TypeScript produced no output):
```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.1.0 /Users/marcogarity/code/pot-events-data/web


 Test Files  3 passed (3)
      Tests  23 passed (23)
   Start at  23:21:15
   Duration  1.58s (environment 67%, setup 13%, import 12%, tests 7%, transform 2%)


> web@0.1.0 lint
> eslint
```

Commit blocker: `git add` failed before staging with:
```text
fatal: Unable to create '/Users/marcogarity/code/pot/.git/worktrees/pot-events-data/index.lock': Operation not permitted
```
The session disallows sandbox escalation, so the requested
`fix(data): review round 1` commit could not be created. The four review files
remain uncommitted. Earlier ABI/deployment integration gates remain as documented
above.

## Cache Components runtime build fix (2026-11-12)

Done: removed only `export const runtime = 'nodejs';` from the Streams route.
Files changed: `web/app/api/streams/route.ts` and this handoff. Pulled origin/main
with `git pull --ff-only origin main` before implementation. No shared config
changes, merge, or push.

Bundled documentation checked (paths relative to repo root):
- `web/node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/cacheComponents.md`,
  line 31: Cache Components requires Node.js and requires removal of every
  `runtime` export, including `nodejs`.
- `web/node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`,
  Caching / With Cache Components: non-GET methods are not cached; the Cache
  Components prerendering discussion applies to GET handlers.
- `web/node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md`,
  Webhooks: POST can read the request body directly without bodyParser or
  additional configuration.
- `web/node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`,
  Runtime Environment Variables: server environment reads are supported during
  dynamic rendering; NEXT_PUBLIC_ values are subject to build-time inlining.

Conclusion: this uncached POST handler needs no replacement segment config,
connection() call, or body configuration for its existing body/env reads.

Required checks:
```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint
 Test Files  7 passed (7)
      Tests  81 passed (81)
   Duration  1.99s
(TypeScript: no diagnostics; exit 0)
> web@0.1.0 lint
> eslint
(combined command exit 0)
```
Existing Vite warning: vitest.config.ts uses ESM syntax while loaded as CommonJS;
configLoader native compatibility warning only.

```text
$ cd web && npm run build
> web@0.1.0 build
> next build
- Cache Components enabled
- Partial Prefetching enabled
Creating an optimized production build ...
```
Initial sandbox build exited 1 because it could not fetch Geist and Geist Mono
from fonts.googleapis.com. Two escalation-requested retries exited 1 with:
```text
Error [TurbopackInternalError]: [project]/app/globals.css.css [app-client] (css)
Caused by:
- creating new process
- binding to a port
- Operation not permitted (os error 1)
```

Blocker: the required production build cannot complete in this environment
because the Turbopack worker's local port binding is denied even on escalation
retries. Build success is NOT claimed; rerun `cd web && npm run build` in an
environment permitting worker port binding and font downloads. `git diff --check`
passes. Earlier live integration gates remain unchanged.
