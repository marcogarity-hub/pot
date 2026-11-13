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
