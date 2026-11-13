# Handoffs: wallet lane

## Task 2.2 — Wallet, transaction, relayer libraries

Done: skipped 2.1 as instructed; WALLET_PATH=circle. SDK method names and fee
units checked in installed SDK dist/types (absolute maxFee/priorityFee in gwei,
gasLimit required; amount in native token decimal units). Stable normalized-email
UUID v4-shaped idempotency key includes the wallet set and network. Polls COMPLETE,
rejects FAILED/DENIED/CANCELLED, leaves CONFIRMED pending, then checks viem receipt.
Prefunding confirms the receipt and conservatively reserves the daily cap before
sending, including uncertain failures. Default cap 50 USDC; in-memory per-process
UTC budget, NOT fleet-wide or durable. Conductor must use a shared atomic budget
before multi-instance deployment. Demo principal CLI shares this cap.

Files: web/lib/circle/{client,contract,wallets,tx,tx.test}.ts,
web/lib/circle/__mocks__/pot.ts, web/lib/relayer/{index,index.test,topup}.ts.

Validation (tests written and observed failing on missing modules before implementation):
```text
$ cd web && npx vitest run lib/circle lib/relayer
 Test Files  2 passed (2)
      Tests  8 passed (8)
$ cd web && npx tsc --noEmit --incremental false
app/layout.tsx(20,50): error TS2304: Cannot find name 'LayoutProps'.
```
Only shared layout type generation blocks tsc; no lane diagnostics. The shared
ES2017 target is respected by using BigInt constructors. No shared files changed.

Integration: Lane 1 must supply generated potAbi with write functions createPot,
pay, swapSeat, refund, requestRelease, object, expire, finalizeRelease; indexed
PotCreated and Paid events; custom errors (especially AlreadyPaid). Production
currently fails closed until configurePotInterface({abi: potAbi, chain: arcTestnet})
is called in server setup. Replace that boundary with direct Lane 1 imports when
available. Temporary ABI and mock chain live ONLY under __mocks__, imported ONLY
by tests. Relayer prefund/topup use viem's installed arcTestnet definition (checked
id 5042002, native USDC decimals 18); no contract ABI needed for plain transfers.
Circle keys, real contract, Circle error-data shape, fee estimates, and live spike
remain unverified. No network calls in tests. No live financial operations run.

## Task 2.3 — Identity and magic-link claim

Done: normalized email; database-arbitrated INSERT ON CONFLICT DO NOTHING owns
provisioning. Other requests poll at most 10 seconds. Mapping becomes visible only
after gas prefunding confirms. claimUser links auth_user_id (never internal id),
conditionally refuses replacing an existing auth link. Callback exchanges code,
verifies getUser, claims identity, and restricts next to relative same-origin
paths (including rejecting encoded slashes/backslashes). /me returns the verified
session email and wallet, or 401. DB/provider failures return generic errors.

Files: web/lib/circle/{identity,identity.test}.ts;
web/app/api/wallet/{callback,me}/route.ts.

Tests written first and observed failing on missing identity.ts, then:
```text
$ cd web && npx vitest run lib/circle lib/relayer app/api/wallet
 Test Files  3 passed (3)
      Tests  18 passed (18)
$ cd web && npx tsc --noEmit --incremental false
app/layout.tsx(20,50): error TS2304: Cannot find name 'LayoutProps'.
```
Blocker unchanged: shared layout needs Next-generated LayoutProps. No lane TS errors.
Operational limitation: crash/provider/funding/persistence failure after reserving
an email leaves a pending users row. It is intentionally not deleted or re-funded
on retry: reconcile its stable Circle idempotency key and treasury transactions,
then recover the row manually. A durable provisioning job/state column would be
needed for unattended recovery; this lane cannot change schema. Other callers get
pending after 10 seconds, never a second wallet or an unfunded usable mapping.

## Task 2.4 — Create pot route and final verification

Done: shared Zod createPotSchema / CreatePotBody export for Lane 4; normalized
emails, duplicate rejection before provisioning, 1–20 members, uint256 positive
USDC total with <=18 decimal places, exact divisibility, future deadline at second
precision, bounded integer threshold/windows. Verified Supabase session required.
Organizer's own wallet signs createPot. Decode potId only from PotCreated at the
configured contract address, checking organizer; write pot_meta and pot_invites
only after confirmation. Returns 201 {potId, inviteToken}. Tokens use 32 random
bytes. Persistence failures return confirmed potId/transactionHash for recovery,
with an explicit instruction not to create another onchain pot.

A7 choice: InMemoryCreatePotLimiter behind CreatePotLimiter interface, keyed by
verified auth user id, rolling one-hour window. Synchronous reservation prevents
concurrent requests exceeding five accepted attempts in a single process; the
sixth returns 429 before provisioning. Counts failed/ambiguous accepted attempts
conservatively. State resets on process restart and is not shared across Vercel
instances. Replace with a shared atomic implementation for fleet-wide enforcement;
no schema/shared config modifications were made. Test covers concurrent creates
and expiry at exactly one hour.

Files added: web/app/api/pots/{schema,limiter,route,route.test}.ts.
Final checks also strengthened identity tests (pending timeout, failed funding,
auth-link conflict), kept callback's helper private to satisfy Next route exports,
and corrected demo funding: topup.ts now calls fundDemoPrincipal, bypassing only
the gas prefunding budget. This supersedes Task 2.2's note that demo principal
shares that cap: A10 principal (e.g. 300 USDC) is independent from A7's daily gas
allowance. Both transfer paths validate addresses/amounts and confirm receipts.
fundDemoPrincipal must never be called by an HTTP route. CLI requires exported
environment variables; from web use `npx tsx lib/relayer/topup.ts <address> <usdc>`.

TDD: route tests observed failing on missing route.ts, then implementation passed;
the demo-cap regression test failed with "Daily prefund cap exceeded" before fix.
Final requested command output (exit 0):
```text
$ cd web && npx vitest run lib/circle lib/relayer app/api/pots app/api/wallet
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.1.0 /Users/marcogarity/code/pot-wallet/web

 Test Files  4 passed (4)
      Tests  47 passed (47)
   Start at  23:15:57
   Duration  2.39s (import 39%, environment 36%, tests 11%, setup 9%, transform 5%)

$ cd web && npx tsc --noEmit
(no output; exit 0)
$ cd web && npx eslint lib/circle lib/relayer app/api/pots app/api/wallet
(no output; exit 0)
$ git diff --check
(no output; exit 0)
```
The earlier LayoutProps failure is resolved: the installed `npx next typegen`
command generated ignored .next types ("Types generated successfully"). No
tracked files outside lane ownership were changed. Clean-checkout verification
must run that typegen command before tsc; conductor may add it to shared CI.
All Circle, viem clients, and Supabase accesses in tests are mocked; no test
network calls. Task 2.1 and Task 2.5 were not implemented, and no live transaction
was submitted. git pull origin main --ff-only succeeded (already up to date).

Remaining integration work: keys and the live Circle+Arc spike; Lane 1 generated
ABI/chain/address and server initialization of configurePotInterface (or replace
the boundary with direct @/lib/pot imports after merge); distributed/durable abuse
budgets and provisioning recovery as described above. There is deliberately NO
production import of the temporary __mocks__/pot.ts fixture. Until the real ABI
is supplied, contract calls fail closed. Metadata recovery after an onchain
success/database failure requires reconciling the returned potId/hash; no
idempotent HTTP create/recovery API was part of Tasks 2.2–2.4.

## Conductor review — round 1

Addressed exactly the six review requests within Wallet lane ownership:
- Verified installed viem _types/index.d.ts exports nonceManager and
  accounts/privateKeyToAccount.d.ts accepts { nonceManager }. Every relayer
  account uses that shared manager, including concurrent prefunds.
- Exported PrefundRefusedError for zero/invalid address, non-positive funding,
  exceeded daily cap, and missing relayer private key. ensureUser deletes only
  its reserved internal id with circle_wallet_id IS NULL when createWallet fails
  or prefund throws that refusal; it rethrows the original error. Ambiguous send
  failures still retain the reservation. This supersedes the earlier handoff's
  blanket statement that every provisioning failure leaves a pending row.
- Circle fee estimation receives exactly callData, contractAddress, amount and
  source; no extra walletId field.
- Both relayer funding and finalize use max(estimated maxFeePerGas, 20 gwei).
- Added server-only markers to circle/client.ts and relayer/index.ts. Tests mock
  the marker. No marker was added to topup.ts. Since the CLI imports the relayer,
  standalone execution must resolve the package's checked react-server export:
  `NODE_OPTIONS=--conditions=react-server npx tsx lib/relayer/topup.ts <address> <usdc>`
  from web, with its required environment variables exported.
- Create-route test asserts the exact ordered lowercase member address list.

Changed files: web/lib/relayer/{index,index.test}.ts;
web/lib/circle/{client,identity,identity.test,tx,tx.test}.ts;
web/app/api/pots/route.test.ts; docs/handoffs/wallet.md.

Regression tests were written first and failed as expected (9 failures), then
passed after implementation. Tests include two concurrent accounts using the
nonce manager, fees above/below the floor for funding/finalize, each specified
pre-send refusal, retry after reservation deletion for both Circle creation and
cap failures, and reservation retention after an ambiguous send failure.
All services and clients remain mocked; no live transactions or network tests.

Final required command output (exit 0 for the entire chain):
```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set `"type": "module"` in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.1.0 /Users/marcogarity/code/pot-wallet/web

 Test Files  4 passed (4)
      Tests  58 passed (58)
   Start at  23:22:49
   Duration  1.53s (environment 51%, import 21%, tests 15%, setup 11%, transform 2%)

> web@0.1.0 lint
> eslint
```
TypeScript emitted no diagnostics. git diff --check also passes. Previous
live-spike, real ABI, multi-instance limits, and ambiguous provisioning recovery
integration items remain. No merge or push performed.

Commit blocker: the requested git add/commit command failed before staging with:
```text
fatal: Unable to create '/Users/marcogarity/code/pot/.git/worktrees/pot-wallet/index.lock': Operation not permitted
```
This session's sandbox denies the shared worktree metadata write and its approval
policy is never, so escalation is unavailable. The verified changes are left
uncommitted. Once Git metadata is writable, stage the nine lane files listed
above and commit with exactly `fix(wallet): review round 1`.

## Task 2.5 — Action routes and finalize (2026-11-12)

Done: Steps 1–4 and 6; Step 5 (live check) explicitly skipped. Added POST pay,
refund, object, expire, request-release, swap, and unauthenticated finalize routes.
Verified Supabase sessions select the caller's Circle wallet through ensureUser;
all signed member/organizer transactions reuse callPot. pay reads the exact bigint
share from onchain getPot. Contract checks remain authoritative for member and
boundary eligibility, including DeadlinePassed at equality.

request-release checks organizer and Locked state, hashes the exact 1–500 character
receiptText with keccak256(toBytes(text)), and updates pot_meta.receipt_text only
after callPot confirms. Missing metadata rows and database errors return 503 with
confirmed potId/transactionHash and recovery guidance. swap checks organizer before
replacement provisioning, normalizes both emails, looks up (never provisions) the
leaver in users, ensures the replacement, signs swapSeat, then upserts pot_invites
on pot_id,address. Former-member invites remain for historical email display.
Confirmed swap persistence failures also return recovery details. No chain-derived
projection tables are written.

finalize reads getPot directly, returns alreadyFinalized for Released, otherwise
requires PayoutRequested, objectionsCount < threshold, and the latest chain block
timestamp >= releaseEligibleAt before calling existing relayerFinalize. This uses
chain time rather than the app server clock. Successful action responses contain
transactionHash; finalize returns the relayer's submitted hash (its existing helper
does not wait for a receipt). The chain/projection determines eventual release.

errors.ts centralizes PotRevertError -> 409 {error: code, message}, including all
four specified readable messages and code fallback; unexpected errors get generic
500 responses. The create route now uses this mapping for PotRevertError while
retaining its existing ambiguous-confirmation/recovery responses for other errors.
Invalid uint256 IDs and invalid/zero wallet addresses are rejected before signing.

Files changed:
- web/app/api/pots/[potId]/{pay,refund,object,expire,request-release,swap,finalize}/route.ts
- web/app/api/pots/{actions,actions.test,errors,route,route.test}.ts
- web/lib/circle/read.ts
- web/lib/circle/__mocks__/pot.ts (test-only ABI additions)
- docs/handoffs/wallet.md

TDD: wrote action tests and create regression first. Initial run failed resolving
missing [potId]/pay/route, and create regression failed `expected 502 to be 409`.
Implemented, then corrected a test-title formatter that could not serialize bigint.
Added passing edge-case checks for confirmed-only swap metadata, missing leaver,
zero replacement, second pay, metadata failure recovery, and invalid chain shape.
All Circle/viem clients/Supabase calls are mocked; tests make no network calls.
Read installed Circle SDK dist/types declarations for existing transaction method
names; this task introduces no new SDK calls and reuses the previously reviewed
transaction, provisioning, prefund, and relayer implementations.

Final validation output (exit 0 for tests, tsc, and lane-scoped ESLint):
```text
$ cd web && npx vitest run lib/circle lib/relayer app/api/pots app/api/wallet
(!) Your Vite config uses features that are unsupported by `configLoader: 'native'`, which is planned to become the default in a future major version of Vite:
  - ESM syntax in a file loaded as CommonJS (vitest.config.ts:1:1). Use a `.mjs` extension or set "type": "module" in the closest package.json
Set `VITE_CONFIG_NATIVE_IGNORE_WARNING=true` to suppress this warning.

 RUN  v5.1.0 /Users/marcogarity/code/pot-wallet/web

 Test Files  5 passed (5)
      Tests  104 passed (104)
   Start at  23:28:57
   Duration  2.97s (environment 53%, import 27%, setup 12%, tests 6%, transform 2%)

$ cd web && npx tsc --noEmit
(no output; exit 0)
$ cd web && npx eslint lib/circle lib/relayer app/api/pots app/api/wallet
(no output; exit 0)
$ git diff --check
(no output; exit 0)
```

Integration / blockers for conductor:
- No keys or deployed contract: Task 2.1 and the Task 2.5 live check remain pending;
  no live transactions were submitted. WALLET_PATH=circle remains assumed.
- Still no production @/lib/pot imports and no production test-fixture imports.
  Configure the existing configurePotInterface boundary with Lane 1's actual
  generated potAbi and arcTestnet (id 5042002), or replace that boundary with direct
  imports once available. In addition to earlier write/event/error requirements,
  read.ts needs getPot(uint256) returning the named PotView tuple in Task 1.2:
  organizer,address; total/share/deadline/threshold/objectionWindow/requestWindow/
  lockedAt,uint256; state,uint8; paymentsCount/objectionsCount,uint256;
  receiptHash,bytes32; releaseEligibleAt,uint256; members,address[]. Specifically
  these routes consume organizer, share, state, threshold, objectionsCount, and
  releaseEligibleAt; malformed tuple results fail closed. Temporary fragments
  remain only in web/lib/circle/__mocks__/pot.ts and are imported only by tests.
- A7 Task 2.4 choice is unchanged: InMemoryCreatePotLimiter behind CreatePotLimiter,
  five accepted attempts/auth user/rolling hour, single-process only. Conductor
  still needs distributed/durable limits before multi-instance use, along with
  provisioning recovery and live fee/error-shape verification noted above.
- Confirmed metadata failures require manual recovery using returned potId/hash.
  Receipt integrity verification remains Lane 4's responsibility (A12).
- Fetched origin/main and fast-forwarded check: Already up to date. No changes
  outside lane ownership, no push, no merge to main. The referenced Superpowers
  execution skills were not found in installed skills; followed explicit TDD.

## Task 2.5 review — missing pots and finalize race (2026-11-12)

Done: readPot identifies a zero organizer with PotNotFoundError; the shared HTTP
mapper returns exactly 404 {error: 'PotNotFound'}. All six authenticated action
routes now read the pot before signing, including refund/object/expire; finalize
uses the same missing-pot handling. Authentication still precedes member reads.
After a relayer finalize failure, re-read getPot: Released (state 3) returns
200 {alreadyFinalized: true}; any other state preserves the original error
mapping. A failed re-read also preserves the original relayer error.

Files changed: web/lib/circle/read.ts;
web/app/api/pots/{actions,actions.test,errors}.ts; docs/handoffs/wallet.md.
No route segment config exports or shared configuration changes.

TDD: seven missing-pot route tests first failed (four 500 responses; three 200
responses), then all passed. Finalize race/error tests first failed (409 instead
of 200 for a competing release; only one read for unreleased failures), then
passed. Reset mocks between tests to discard unconsumed one-shot responses.
Tests cover all seven action routes, Released after a revert, unreleased custom
and unexpected errors, and a failed re-read. All providers remain mocked.

Required command run:
```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint && npm run build
 Test Files  8 passed (8)
      Tests  138 passed (138)
   Duration  2.03s
(TypeScript: no diagnostics, exit 0)
> web@0.1.0 lint
> eslint
(lint exit 0)
> web@0.1.0 build
> next build
Error [TurbopackInternalError]: [project]/app/globals.css.css [app-client] (css)
Caused by:
- creating new process
- binding to a port
- Operation not permitted (os error 1)
(build exit 1)
```
Existing Vite CommonJS/ESM config compatibility warning remains. Retried
`npm run build` with sandbox escalation; it failed with the same port-binding
permission error (exit 1). The production build cannot run to completion in this
sandbox; conductor must run it in an environment allowing Turbopack worker port
binding. Build success is not claimed. git diff --check passed. Pulled origin/main
before changes (already up to date). No merge, push, or live transactions.

## Amendment A15 — Circle treasury relayer (2026-11-12)

Done: replaced all raw-key relayer signing with the Circle developer-controlled
treasury wallet. Gas prefund and demo-principal topup share createTransaction;
finalize uses callPot with finalizeRelease and returns the confirmed receipt hash.
relayerBalance reads the TREASURY_ADDRESS native balance through viem and warns
below 5 USDC (also checked before finalize). No route changes or segment exports.

Verified the installed SDK dist/types/developer-controlled-wallets.d.ts:
CreateTransferTransactionInput/createTransaction use amount: string[], walletId,
and tokenAddress: '' for native tokens. With walletId, the submission blockchain
field is excluded by the type; the wallet ID must identify the ARC-TESTNET treasury.
EstimateTransferFeeInput accepts blockchain: 'ARC-TESTNET' alongside that native
selector. Both funding paths use decimal USDC amounts, estimate absolute fees,
and apply max(estimate.maxFee, 20) in gwei, matching callPot. Funding polls for
COMPLETE, rejects FAILED/DENIED/CANCELLED, and verifies a successful viem receipt;
CONFIRMED remains pending, with a 120-second Circle polling deadline.

Environment: CIRCLE_TREASURY_WALLET_ID + TREASURY_ADDRESS replace
RELAYER_PRIVATE_KEY, which is gone from TypeScript. Existing CIRCLE_API_KEY and
CIRCLE_ENTITY_SECRET remain required for Circle signing. No .env files changed.
CLI from web (export these env vars first):
`NODE_OPTIONS=--conditions=react-server npx tsx lib/relayer/topup.ts <address> <usdc>`.
It uses the same Circle treasury transfer while bypassing only the gas cap.
PREFUND_DAILY_CAP retains its default 50 USDC, synchronous reservation, UTC-day
reset, and conservative retention after uncertain failures. The budget remains
in-memory per process; distributed/durable enforcement remains conductor work.
PrefundRefusedError covers zero/invalid destination, non-positive amount, cap
exhaustion, and missing treasury wallet ID before submission. Circle owns nonces.

Files changed: web/lib/relayer/{index,index.test,topup}.ts;
web/lib/circle/tx.ts; docs/handoffs/wallet.md.

TDD: replaced raw-key/nonce-manager tests first; observed 12 failures against the
old implementation (including missing relayerBalance and absent Circle submits).
Implementation then passed. Tests mock Circle and viem: no network or live
transactions. Covers two concurrent Circle prefunds, cap reservations/default/UTC
reset, refused and ambiguous failures, CLI principal separation, terminal states,
timeout, receipt failure, both fee-floor cases, finalize calldata/treasury wallet,
and balance warning boundary.

Required validation:
```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint && npm run build
 Test Files  8 passed (8)
      Tests  154 passed (154)
   Duration  2.30s
(TypeScript: no diagnostics, exit 0)
> web@0.1.0 lint
> eslint
(lint exit 0)
> web@0.1.0 build
> next build
Error [TurbopackInternalError]: [project]/app/globals.css.css [app-client] (css)
Caused by: creating new process; binding to a port;
Operation not permitted (os error 1)
(build exit 1)
```
Retried npm run build with sandbox escalation: same port-binding restriction,
exit 1. Build cannot complete in this sandbox; conductor must run it outside this
restriction. Existing Vite config compatibility warning remains. git diff --check
passes; grep -rn RELAYER_PRIVATE_KEY web --include='*.ts' --exclude-dir=node_modules
returns no matches (exit 1). Pulled origin/main before edits: already up to date.
No changes outside the five listed files, no merge, no push. Remaining live-spike,
ABI setup, and provisioning-recovery gates from earlier handoffs are unchanged.
