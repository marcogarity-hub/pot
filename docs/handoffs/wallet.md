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
