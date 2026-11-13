# Merge log

## 2026-11-12 — lane/events-data (Task 3.1, smoke test)
- Landed: supabase/migrations 20261113000000_init.sql + 20261113000100_rls_realtime.sql (users per A6, pot_meta, pot_invites, pot_events, pots, pot_members, pot_status view, RLS, realtime publication); applied to the hosted project.
- Gates: dry-run OK; real `db push` OK; `db lint --linked --fail-on error` clean; reviewer APPROVE (no blockers); main builds and tests pass after merge.

## 2026-11-12 — lane/events-data (Tasks 3.2, 3.3, 3.4 hook)
- Landed: decodePotLogs/foldPot, /api/streams with QuickNode HMAC + 5 MB cap, PotStore (memory + Supabase), apply_pot_projection migration (applied), usePot hook. Route returns 503 until Lane 1's ABI replaces abi-placeholder.ts.
- Gates: round 1 CHANGES (lint error, gzip cap) → fixed (conductor committed; worker sandbox couldn't write git lock); vitest 23/23, tsc, lint clean; db push + db lint clean; reviewer APPROVE.

## 2026-11-12 — lane/wallet (Tasks 2.2, 2.3, 2.4)
- Landed: Circle wallet/tx libs, relayer (nonceManager, PrefundRefusedError, cap), ensureUser/claimUser + /api/wallet/callback + /me, POST /api/pots with rate limit. Real contract calls wait on Lane 1's ABI (configurePotInterface).
- Gates: round 1 CHANGES (relayer nonce race, stuck users row + 4 small) → fixed (conductor committed; sandbox git lock); vitest, tsc, lint clean on main after merge; reviewer APPROVE.

## 2026-11-12 — lane/events-data (build fix)
- Landed: removed `export const runtime` from /api/streams (incompatible with cacheComponents; broke Vercel build). Handoff's "build blocked" note is stale: the build passes.
- Gates: vitest 81/81, tsc, lint, `npm run build` OK (worker sandbox couldn't bind Turbopack port; conductor + reviewer ran it); reviewer APPROVE.

## 2026-11-12 — lane/wallet (Task 2.5)
- Landed: pay/refund/object/expire/request-release/swap/finalize routes, errors.ts toHttp (409s), create route revert mapping. Live check (Step 5) pending keys + deploy.
- Gates: vitest, tsc, lint clean; `npm run build` OK on main after merge; reviewer APPROVE (non-blocking: 404 for missing pot, finalize race → alreadyFinalized).

## 2026-11-12 — lane/wallet (polish)
- Landed: 404 PotNotFound for non-existent pots on all [potId] routes; finalize returns alreadyFinalized after a lost race.
- Gates: vitest 138/138, tsc, lint, build OK (conductor + reviewer; worker sandbox can't run Turbopack build); reviewer APPROVE.

## STATE SNAPSHOT — 2026-11-13 (overnight start; resume from here after any cutoff)
- Lane 1 (contract): background Claude worker `lane-contract` (claude --bg, id 4a244727) in ~/code/pot-contract, Tasks 1.2–1.5. Next: gates (tests, Opus reviewer, /codex:adversarial-review) → deploy with contracts/.env deployer (pre-approved) → publish ABI+address to web/lib/pot/ → tell Lanes 2/3 to swap mocks/placeholder.
- Lane 2 (wallet): treasury round-1 fix 22b6a2f on lane/wallet in ~/code/pot-wallet; tests/build pass; awaiting re-review. Next task after merge: pre-flight simulateContract for revert codes (docs/handoffs/conductor.md item 2). Then wire real potAbi when Lane 1 lands.
- Lane 3 (events): idle, merged through build fix. Next: swap abi-placeholder for @/lib/pot potAbi after Lane 1 deploy; then QuickNode Stream (needs a QuickNode account → morning question).
- Lane 4 (UI): not started (waits on Claude Design bundle from Marco).
- Spikes done: PAYMENT_PATH=native, ACCOUNT_TYPE=EOA (A14 gate passed). Treasury 0x9f74…7c07, deployer 0xe38E…862A, ~19 USDC each.
- Reviewer models: Opus for Lane 1, Sonnet for others (Marco, overnight).
- Morning questions so far: custom SMTP provider account; QuickNode account; may Lane 4 build plain sign-in/join before the design bundle?

## 2026-11-13 — lane/wallet (A15 treasury)
- Landed: relayer signs via Circle treasury wallet (no raw key); native transfers send tokenAddress "" + blockchain ARC-TESTNET; idempotency keys; STUCK = failure; balance check advisory.
- Gates: round 1 CHANGES (missing blockchain on transfer) → fixed; vitest 162/162, tsc, lint, build OK; reviewer APPROVE.

## 2026-11-13 — lane/wallet (pre-flight simulation)
- Landed: callPot simulates from the caller's address (treasury for finalize) before Circle; declared custom errors → PotRevertError without submitting; RPC failure warns and submits; Circle tx id in failure messages.
- Gates: vitest 169/169, tsc, lint, build OK; reviewer (Sonnet) APPROVE. Open: confirm Arc RPC returns revert data on eth_call once Pot is deployed.

## 2026-11-13 — lane/contract (Tasks 1.2–1.5)
- Landed: IPot/Pot.sol (createPot, pay, swapSeat, refund, requestRelease, object, finalizeRelease, expire; PotCreated…Frozen events; MAX_MEMBERS 20), tests 0–23 + 3 invariants, web/lib/pot (potAbi, arcTestnet, POT_ADDRESS, POT_DEPLOY_BLOCK).
- Gates: arc-forge test 75/75, invariants 10000 runs 0 reverts (271s); web tsc/vitest/build OK; Opus reviewer APPROVE; Codex adversarial "needs-attention" with one HIGH (not critical) finding = known gap: a contract organizer that rejects payment strands a PayoutRequested pot. Not reachable in-app (organizers are Circle EOAs, A1/A14). Fix needs a spec change → question for Marco.
