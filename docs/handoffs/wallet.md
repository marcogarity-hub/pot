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
