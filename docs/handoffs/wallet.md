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
field is excluded by the type, but the 2026-11-13 conductor spike verified that
submission must include blockchain: 'ARC-TESTNET' with tokenAddress: ''. The
review fix below uses a narrow cast to pass that field through to REST.
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

## Treasury review — round 1 (2026-11-13)

Done: addressed all four requested fixes, limited to the two libraries and this
handoff. Native createTransaction now sends tokenAddress: '' and blockchain:
'ARC-TESTNET' with walletId, using the requested narrow SDK-input cast and a
comment citing the conductor's 2026-11-13 live spike. Corrected the A15 note above.
Each transfer submission gets crypto.randomUUID() as idempotencyKey; polling
timeouts include both the Circle transaction ID and that submitted key for
reconciliation. Both transfer and contract waiters reject STUCK alongside
FAILED/DENIED/CANCELLED and include errorReason/errorDetails. Contract failures
retain PotRevertError codes, including decoded custom errors when data exists.
Finalize catches advisory balance-read failures and logs a warning, then proceeds
through callPot even with an unset TREASURY_ADDRESS or failed balance RPC.

Files changed: web/lib/relayer/{index,index.test}.ts;
web/lib/circle/{tx,tx.test}.ts; docs/handoffs/wallet.md.

TDD: updated tests first and observed 14 failing tests, then implemented fixes.
Coverage includes explicit native submission chain, unique UUID keys for concurrent
funding, timeout key reconciliation, all four terminal states with diagnostics in
both waiters, preservation of decoded revert codes, and successful finalize after
missing-address/RPC balance failures. All service calls are mocked; no live
transactions were submitted.

Required validation (combined command exit 0):
```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint
 Test Files  8 passed (8)
      Tests  162 passed (162)
(TypeScript: no diagnostics; exit 0)
> web@0.1.0 lint
> eslint
(lint exit 0)
```
Existing Vite CommonJS/ESM configuration warning remains. git diff --check passed.
Production build is left to the conductor as requested. No route files, segment
config exports, or shared configuration changed. No merge or push.

Before edits, fetched origin/main via git pull --ff-only origin main; the pull
could not fast-forward because main and this lane have diverged. The local
conductor handoff was still a heading only, so read the fetched
origin/main:docs/handoffs/conductor.md for the 2026-11-13 verified spike results.
No merge/rebase performed; conductor integrates this commit. No new blockers for
the four review fixes. Other integration items remain with the conductor.

## Pre-flight contract simulation (2026-11-13)

Done: callPot looks up the signing address with Circle getWallet({id: walletId})
and simulates the configured Pot ABI/function/args/native value from that address
before Circle fee estimation or submission. Uses the configured Arc chain and
explicit https://rpc.testnet.arc.io transport. Walks viem BaseError causes for
ContractFunctionRevertedError; ABI-declared custom errors become PotRevertError
codes immediately, without submitting to Circle. RPC failures, unavailable wallet
lookups, and undecodable reverts log a warning and defer to Circle. Existing
callPot signatures/callers and configurePotInterface boundary remain unchanged.
Submitted terminal failures and reverted receipts now include the Circle
transaction ID in their error message for reconciliation.

Files changed: web/lib/circle/{tx,tx.test}.ts;
web/lib/circle/__mocks__/pot.ts (test-only DeadlinePassed fragment);
web/lib/relayer/index.test.ts (mock the treasury pre-flight); this handoff.
No route, route segment config, shared config, or production ABI changes.

Checked installed declarations before implementation:
- viem/_types/actions/public/simulateContract.d.ts: account override, ABI,
  functionName, args, and mutability-aware value parameters.
- viem/_types/errors/{base,contract}.d.ts: BaseError.walk,
  ContractFunctionExecutionError, ContractFunctionRevertedError.data.errorName.
- Circle dist/types/developer-controlled-wallets.d.ts: getWallet({id}) returns
  data.wallet, whose address supplies the simulation account.

TDD: new regressions first failed against the old implementation (12 failures,
5 passes after correcting the wrapped viem error test's required args). Then
implementation passed. Covers AlreadyPaid/DeadlinePassed stopping estimation and
submission, correct signing address/function/value, unchanged Circle calldata and
amount, simulation before estimation, RPC/lookup/undecodable-error fallback,
terminal-state diagnostics, and reverted-receipt transaction ID. Existing route
409 message tests continue passing. All providers are mocked; no live calls or
transactions were performed.

Required validation (combined exit 0):
```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint
 Test Files  8 passed (8)
      Tests  169 passed (169)
(TypeScript: no diagnostics; exit 0)
> web@0.1.0 lint
> eslint
(lint exit 0)
```
Existing Vite CommonJS/ESM configuration warning remains. Production build stays
with the conductor as requested. Pulled origin/main before editing: already up
to date (required escalation for shared Git metadata). No merge or push.

Blockers: none for this task. Lane 1 still supplies the real ABI and production
configurePotInterface setup. Simulation is advisory: state can change before
Circle submits, and Circle failures without revert data still use
TransactionFailed, now with the reconciliation transaction ID.

## Deployed Pot ABI and address wiring (2026-11-13)

Done: contract.ts defaults to potAbi and arcTestnet from @/lib/pot at module
load, and potAddress validates the shared POT_ADDRESS export. Production no
longer needs configurePotInterface; the injection hook remains for tests.
Missing/invalid deployment addresses produce PotConfigurationError mapped to
503 PotUnavailable with a clear NEXT_PUBLIC_POT_ADDRESS message. Creation and
all seven action routes check configuration before provisioning or chain calls.
Removed the temporary __mocks__/pot.ts ABI; all wallet/relayer/route tests now
exercise the generated real ABI. Tests mock only the shared address export where
per-test environment changes are needed (production uses its build-time value).

Confirmed createPot argument order is total, share, members, deadline, threshold,
objectionWindow, requestWindow. The route test builds a PotCreated log with real
potAbi and checks decoded ID, organizer, submitted arguments, and metadata.
readPot consumes the named object viem returns for the real PotView tuple; a
real-ABI wire encode/decode round trip with distinct values checks share, state,
threshold, objectionsCount, and releaseEligibleAt, including Frozen state 4.
No positional decoding change was necessary. No Lane 1 files changed.

Files changed: web/lib/circle/{contract,contract.test,read,tx.test}.ts;
removed web/lib/circle/__mocks__/pot.ts; web/lib/relayer/index.test.ts;
web/app/api/pots/{actions,actions.test,errors,route,route.test}.ts; this handoff.

TDD: switched existing suites to the real ABI without configuring the interface,
and added missing-address route regressions first: 54 failures / 36 passes in
the route/action suites before implementation. Added default-interface, injection,
shared-address and real PotView wire-decoding checks. All providers mocked; no
live transactions submitted.

Required validation (combined exit 0):
```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint
 Test Files  9 passed (9)
      Tests  182 passed (182)
(TypeScript: no diagnostics; exit 0)
> web@0.1.0 lint
> eslint
(no diagnostics; exit 0)
```
Existing Vite config CommonJS/ESM compatibility warning remains. git diff --check
passed. Production build is left to the conductor as requested. Pulled origin/main
before edits (already up to date; escalation required for shared Git metadata).
No route segment config exports, shared config edits, merge, or push.

Blockers: none for this wiring task. Set NEXT_PUBLIC_POT_ADDRESS to the deployed
address before building; no deployment environment files were changed here.

## 2026-11-13 — Adversarial review fixes

Done: Circle confirmation timeouts now throw `CircleTimeoutError` with the Circle
transaction ID, mapped by action and create routes to 502 `TransactionPending`
with the refresh guidance and reconciliation ID. Finalize now re-reads chain
state inside an in-process per-pot single-flight, so concurrent requests share
one relayer promise. `/api/wallet/me` is read-only and returns 404 `{ error:
"NoWallet" }`; callback claiming links only an existing email row. The create
route lazily provisions its organizer after the existing per-user rate limiter.
Stale null-wallet reservations older than 120 seconds are claimed with a
conditional timestamp update before retrying idempotent Circle wallet creation.
Prefund daily capacity now reserves/releases through the service-role Supabase
RPC interface; the existing five-pots/hour creation limiter remains in-process.

Files changed: `web/lib/circle/{tx,tx.test,identity,identity.test}.ts`,
`web/lib/relayer/{index,index.test}.ts`, `web/app/api/pots/{actions,actions.test,
errors,route,route.test}.ts`, `web/app/api/wallet/me/route.ts`, this handoff.

TDD: added regressions and observed expected failures for timeout mapping,
concurrent finalize duplication, `/me` provisioning, missing-user claims, and
stale reservation takeover before implementing fixes. All external services are
mocked. No live wallet or chain operations were run.

Validation:
```text
$ cd web && npx vitest run
 Test Files  14 passed (14)
      Tests  242 passed (242)
$ cd web && npx tsc --noEmit
Failed on Lane 4 page route types only: app/(screens)/join/[inviteToken]/page.tsx,
app/(screens)/pots/[potId]/page.tsx, app/(screens)/sign-in/page.tsx. The generated
route type constraint currently accepts only "/". No wallet-lane diagnostics.
$ cd web && npm run lint
eslint (exit 0; no diagnostics)
```

Integration: Lane 3 must provide `public.reserve_prefund(p_amount numeric,
p_cap numeric)` and `public.release_prefund(p_amount numeric)` with service-role
execution as specified in the task. The HTTP create limiter remains an
in-process five pots/hour/auth user limiter; distribute it before multi-instance
abuse enforcement is required. `git pull --ff-only origin main` was blocked
because worktree metadata at `/Users/marcogarity/code/pot/.git/worktrees/pot-wallet`
is not writable in this sandbox. No merge or push.

## Conductor review — round 1 of 2

Done: concurrent finalize requests each receive a clone of the shared Response,
so both response bodies remain readable. `claimUser` now links an existing row,
keeps the linked-to-another-account error, and returns normally when no row exists
without provisioning. The create-pot route claims the signed-in organizer's row
after ensuring its wallet and before calling `createPot`.

Files changed: `web/app/api/pots/{actions,actions.test,route,route.test}.ts`,
`web/lib/circle/{identity,identity.test}.ts`, this handoff.

TDD: regression tests first failed for the consumed concurrent response body,
first-time callback 503, absent-row claim rejection, and missing organizer link.
The tests then passed, including existing invited-member claim and preservation
of the linked-to-another-account conflict. No wallet is created by callback.

Validation (exit 0): `cd web && npx vitest run` (14 files, 243 tests),
`npx tsc --noEmit`, and `npm run lint`. No live wallet or chain operations ran.

## Conductor review — 2026-11-13 wallet fixes

Done:
- Removed the 120-second reservation takeover and all `created_at` rewrites. A
  successful `createWallet` is persisted to `circle_wallet_id` and
  `wallet_address` before prefunding. Only a `createWallet` failure releases a
  reservation; ambiguous prefund failures retain the wallet mapping. Retries use
  a stable UUID v5-style SHA-256-derived key from `pot-prefund:<users.id>` and
  replay the same Circle transfer request.
- Checked the installed `@circle-fin/developer-controlled-wallets` 10.8.1
  typings (`dist/types/clients/core.d.ts`, `WithIdempotencyKey`): Circle defines
  the key as a unique identifier for duplicate requests so identical requests
  have the effect of one request; it generates one if omitted. This guarantees
  transfer idempotency for the identical request. No live duplicate-key call
  was made.
- Prefund ledger RPC errors now throw plain `Error('Prefund ledger unavailable')`;
  only `data === false` is the cap refusal. The daily cap must be a positive
  decimal. Fee-estimation errors/incomplete estimates, invalid fee values, and
  missing treasury wallet id are marked pre-submit and release the reservation;
  once `createTransaction` is invoked, errors remain ambiguous and retain it.
  Removed `resetPrefundBudget` and its test references.
- Create-pot Circle timeouts now return the exact `CreatePending` 502 response
  using `instanceof CircleTimeoutError`. Identity-link conflicts return the
  specified 409. The rate-limit slot is still consumed for identity failures:
  the limiter reserves synchronously before asynchronous identity provisioning
  to preserve the five-concurrent-request bound; validation failures occur
  before the limiter and do not consume a slot.
- Finalize single-flight now shares a plain `{status, body}` result and creates
  a fresh JSON Response per caller. Re-reading chain state after relayer failure
  remains the cross-instance race protection.

Files changed: `web/lib/circle/{identity,identity.test}.ts`,
`web/lib/relayer/{index,index.test}.ts`, `web/app/api/pots/{route,route.test,
actions,actions.test}.ts`, and this handoff.

TDD: new/updated regression tests failed before implementation for wallet
persistence ordering, ledger error distinctions, pre-submit reservation release,
create-pending/identity-conflict mapping, and fresh finalize responses. All then
passed. Full validation passed:
```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint
 Test Files  19 passed (19)
      Tests  273 passed (273)
TypeScript: no diagnostics
ESLint: exit 0 (one pre-cleanup unused-import warning; removed afterward)
```
No live Circle operation was run. The create route still has its documented
single-process rate limiter. Reconciliation of a pot whose Circle transaction
confirms after timeout is a follow-up; this response prevents duplicate resubmits
while metadata is pending.

## Conductor review — round 1 (2026-11-13)

Done: `ensureUser` now checks an existing wallet's native Arc balance and retries
the deterministic-key prefund only when the balance is exactly zero. A balance
read failure logs a warning and skips the retry; it does not block the caller.
Added `getWalletUser`, a normalized-email read-only lookup that returns a wallet
row or null. Pot action handlers use it for caller identity, return 403
`NotAMember` when no wallet exists, and never provision/prefund the caller.
`ensureUser` remains in the intended provisioning paths, including replacement
wallet setup.

Files changed: `web/lib/circle/{identity,identity.test}.ts`,
`web/app/api/pots/{actions,actions.test}.ts`, and this handoff.

Coverage: funded existing wallet skips prefund; zero-balance wallet retries with
the stable key; balance-read failure skips prefund; read-only lookup normalizes
email; pay/object and other simple actions do not provision; absent caller wallet
returns the specified 403.

Validation: `cd web && npx vitest run && npx tsc --noEmit && npm run lint` passed
(19 files, 282 tests; no TypeScript diagnostics; ESLint exit 0). No live Circle
or chain calls were made. `git pull --ff-only origin main` could not access the
shared worktree's `FETCH_HEAD` due to sandbox metadata permissions; no merge or
push performed.

## 2026-11-15 — Pot metadata reconciliation endpoint

Done: added `POST /api/pots/reconcile`. It validates the shared title/member-email
rules plus exactly one recovery identifier, resolves the signed-in wallet through
read-only `getWalletUser`, checks Circle transaction ownership/state when given a
Circle ID, fetches the Arc receipt, verifies `PotCreated` organizer and the exact
on-chain member-address set, then persists metadata/invites. Existing metadata is
returned idempotently; a unique insert race re-reads the winning invite token.
The existing create route's `CreatePending` 502 and metadata-failure 503 response
bodies were left unchanged.

Files changed: `web/app/api/pots/{schema.ts,reconcile/route.ts,reconcile.test.ts}`,
`web/lib/circle/{read.ts,transactions.ts,receipt.ts}`, this handoff.

TDD: the new route suite first failed to resolve the absent route (14 tests), then
passed after implementation. Tests exercise 401, neither/both IDs, Circle wallet
ownership, nonterminal/terminal Circle state, missing receipt, organizer mismatch,
member mismatch, first write, existing row, unique-violation race, DB failure, and
transactionHash input. Full suite includes those 14 tests.

### Lane 4 contract

| Request | Response | Meaning |
|---|---|---|
| `POST {title, memberEmails, circleTransactionId}` | `202 {error:"StillPending", message:"Still confirming. Checking again shortly."}` | Circle is not `COMPLETE`, or the receipt is not available yet. |
| Same, Circle terminal failure | `409 {error:"CreateFailed", message:"The pot was not created. It is safe to try again."}` | Circle state is `FAILED`, `CANCELLED`, `DENIED`, or `STUCK`, or receipt reverted. |
| `POST {title, memberEmails, transactionHash}` | `201 {potId, inviteToken}` | First successful metadata and invite persistence. |
| Either valid request for a pot already in `pot_meta` | `200 {potId, inviteToken}` | Existing token returned; metadata not inserted again. |
| Invalid body / neither or both identifiers | `400 {message}` | Zod validation failed. |
| No session email | `401 {error:"Unauthorized"}` | Authentication required. |
| Caller has no wallet, Circle transaction belongs to another wallet, or chain organizer differs | `403 {error:"NoWallet"}` or `{error:"Forbidden"}` | Caller cannot reconcile this pot. |
| Email has no wallet or requested wallet set differs from chain | `422 {error:"MembersMismatch"}` | Invite list does not match on-chain members. |
| Database write fails | `503 {message:"Could not save the pot yet. Try again."}` | Retry reconciliation; do not create another pot. |

The hash form requires `0x` plus exactly 32 bytes of hex. `memberEmails` follows
`createPotSchema`: 1–20 normalized, valid, unique emails.

Gates:
```text
$ cd web && npx vitest run
 Test Files  23 passed (23)
      Tests  316 passed (316)

$ cd web && npx tsc --noEmit
(no output; exit 0)

$ cd web && npm run lint
> web@0.1.0 lint
> eslint
(exit 0)

$ cd web && npm run build
Failed: next/font could not fetch Geist and Geist Mono from Google Fonts in the
sandbox. Retried with network access; Turbopack then failed creating a process
because binding to a port is not permitted (os error 1). Build remains blocked by
the environment, not by a reported application diagnostic.
```

## Conductor review — round 1 (2026-11-15)

Done: reconciliation now returns retryable 503 for member-wallet lookup and
`readPot` failures; 422 remains for missing/duplicate/invalid member wallets or
an on-chain member-set mismatch. Receipt reads use the chain's default RPC.
Added regression coverage for lookup and RPC failures.

Validation: `cd web && npx vitest run && npx tsc --noEmit && npm run lint`
passed (23 files, 318 tests; no TypeScript diagnostics; ESLint exit 0).

## Error and validation copy (2026-11-15)

Done: every error name in the generated `potAbi` has a plain user-facing sentence; contract and app error codes/statuses are retained. Create and reconcile validation messages now prefix the first issue with a field label, except pathless cross-field errors. Regression tests require complete ABI coverage and exercise title/total and pathless validation.

Contract error code → message:

| Code | Message |
|---|---|
| AlreadyObjected | You've already objected. |
| AlreadyPaid | You've already paid into this pot. |
| AlreadyRefunded | You've already been refunded. |
| DeadlineNotPassed | The deadline hasn't passed yet. |
| DeadlinePassed | The deadline has passed. |
| DuplicateMember | Each member must have a different email address. |
| FormerMember | That person has already left this pot. |
| InvalidParams | Check the pot details and try again. |
| NotImplemented | That action is not available yet. |
| NotMember | You're not part of this pot. |
| NotOrganizer | Only the organizer can do that. |
| NotRefundable | There's nothing for you to refund here. |
| ReentrancyGuardReentrantCall | That action is already being processed. |
| RequestWindowOpen | The organizer still has time to request the payout. |
| TransferFailed | The payment was rejected by the receiving address. |
| WindowClosed | The objection window has closed. |
| WindowOpen | The objection window is still open. |
| WrongAmount | That isn't your share of this pot. |
| WrongState | That action isn't available at this stage of the pot. |
| ZeroAddress | A wallet address is missing or invalid. |

Files: `web/app/api/pots/errors.ts`, `errors.test.ts`, `route.ts`, `route.test.ts`, `reconcile/route.ts`, `reconcile.test.ts`, `actions.test.ts`.

TDD: the new regressions first failed for missing error wording and unlabelled create validation; the focused suite passed after implementation. Full gate command output:

```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint && npm run build
Test Files  30 passed (30)
Tests  351 passed (351)
TypeScript: exit 0, no diagnostics
Lint: exit 0, no diagnostics
Build: FAILED (exit 1)
Turbopack build encountered 1 warning:
[next]/internal/font/google/bricolage_grotesque_d13dde08.module.css
Warning: Error while requesting resource
There was an issue establishing a connection while requesting https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@200..800&display=swap
Error: next/font: error:
Failed to fetch Bricolage Grotesque from Google Fonts.
If you are offline or behind a proxy, self-host the font with next/font/local, or set HTTP_PROXY/HTTPS_PROXY so Next.js can reach fonts.googleapis.com.
```

Blocker: build depends on network access to Google Fonts, unavailable in this environment. No changes outside Lane 2 ownership; no merge or push.

## 2026-11-16 — Create deadline cap and payout request error copy

Done: `createPotSchema` now limits deadlines to `MAX_DEADLINE_SECONDS` (365 days)
from the current whole-second timestamp, while retaining the existing future
deadline check and message. Added the `RequestWindowClosed` user-facing message.
Tests cover the exact limit, one second over, past-deadline wording, labeled
validation copy, and a far-future POST response.

Files changed: `web/app/api/pots/{schema.ts,errors.ts,route.test.ts,errors.test.ts}`;
this handoff.

TDD: new tests first failed for missing `MAX_DEADLINE_SECONDS`/cap behavior and
missing `RequestWindowClosed` copy; all focused regressions then passed.

Required gates (command exit 1 due to build):
```text
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint && npm run build
 Test Files  30 passed (30)
      Tests  356 passed (356)
TypeScript: no diagnostics; exit 0
> web@0.1.0 lint
> eslint
(exit 0)
> web@0.1.0 build
> next build
▲ Next.js 16.4.6 (Turbopack)
  Creating an optimized production build ...
Turbopack build encountered 1 warning:
[next]/internal/font/google/bricolage_grotesque_d13dde08.module.css
Warning: Error while requesting resource
There was an issue establishing a connection while requesting https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@200..800&display=swap
Build error occurred
Error: Turbopack build failed with 1 error:
[next]/internal/font/google/bricolage_grotesque_d13dde08.module.css
Error: next/font: error:
Failed to fetch Bricolage Grotesque from Google Fonts.
```

`git diff --check` passed. No live wallet/chain operations, merge, or push.

## 2026-11-16: Server-side error logging for POST /api/pots

Done: `describeError` (whitelisted fields only, secrets and Bearer/API-key strings redacted, message capped at 300 chars) and `logApiError` in `web/app/api/pots/errors.ts`. One `console.error` line prefixed `[api/pots]` at: provisioning 503, final 502 around callPot (CircleTimeoutError and PotRevertError excluded), metadata-recovery 503, and the toHttp 500 fallthrough. Response bodies and statuses are unchanged.

Files changed: `web/app/api/pots/errors.ts`, `web/app/api/pots/errors.test.ts`, `web/app/api/pots/route.ts`, `web/app/api/pots/route.test.ts`, `docs/handoffs/wallet.md`.

Next for the deployed app: redeploy, reproduce POST /api/pots, then read the `[api/pots] provisioning failed: {...}` line in Vercel logs for Circle's real error name, status and code.

Gates (run from web/):
```text
$ npx vitest run
 Test Files  30 passed (30)
      Tests  375 passed (375)
exit 0
$ npx tsc --noEmit
exit 0 (no output)
$ npm run lint
exit 0
$ npm run build
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
exit 0
```

## 2026-11-16: Email sign-in callback failures redirect to sign-in

Done: `web/app/api/wallet/callback/route.ts` now answers failed or expired sign-in links with a 302 to `/sign-in?error=link` (plus `&next=` when the `next` target is valid) instead of JSON. Three failure reasons: `missing_code`, `provider_error` (any of `error`, `error_code`, `error_description` in the query; checked first), `exchange_failed` (exchange returns an error or throws). Each failure logs one line: `[api/wallet/callback] sign-in failed: {"reason":...,"supabaseCode":...}`. `supabaseCode` is the `error_code` param (provider) or the exchange error `code`, only if 1-40 characters; never the code, tokens, email or URL. `next` uses the same rule as `safeNext` in `web/components/pot/auth.ts` (the route keeps its own copy, which also checks the decoded value, so the success path is unchanged). Success path unchanged.

Not changed (outside the three listed cases): `getUser` failure and `claimUser` 503 still return JSON.

Files changed: `web/app/api/wallet/callback/route.ts`, `web/app/api/wallet/callback/route.test.ts` (new, 13 tests).

Gates (run from web/):
```text
$ npx vitest run
 Test Files  32 passed (32)
      Tests  415 passed (415)
exit 0
$ npx tsc --noEmit
exit 0 (no output)
$ npm run lint
exit 0
$ npm run build
◐  (Partial Prerender)  prerendered as static HTML with dynamic server-streamed content
ƒ  (Dynamic)            server-rendered on demand
exit 0
```
