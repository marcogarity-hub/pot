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

## 2026-11-13 — conductor: shadcn init
- Landed: shadcn 4.23.0 init + button/input/label/card/progress/badge/select/textarea/separator/sonner. New deps all from shadcn (cn, @base-ui/react, class-variance-authority, lucide-react, next-themes, sonner, tw-animate-css). Build/tests/lint OK.

## 2026-11-13 — lane/wallet (wire deployed ABI)
- Landed: production uses @/lib/pot potAbi/POT_ADDRESS/arcTestnet; mocks removed; 503 when address unset; real PotCreated/PotView decoding tests.
- Gates: vitest 182/182, tsc, lint, build OK; reviewer (Sonnet) APPROVE.

## 2026-11-13 — lane/events-data (wire deployed ABI)
- Landed: /api/streams uses @/lib/pot potAbi + POT_ADDRESS; placeholder deleted; fixture generated from potAbi at the deployed address; end-to-end decode test; Expired → state 4.
- Gates: vitest, tsc, lint, build OK on main after merge; reviewer (Sonnet) APPROVE. Lane 3 remaining: QuickNode Stream (needs Marco's account).

## 2026-11-13 — lane/contract (liveness hardening)
- Landed: invariant handler mustSucceed for Funding refunds after deadline and eligible expire; test_22 pins Expired-only; chain.ts strict assertPotAddress (+ re-export, 7 tests), POT_DEPLOY_BLOCK empty-safe. Pot.sol unchanged (deployed bytecode still matches).
- Gates: arc-forge 75/75 + invariants 10000 runs; web vitest/tsc/lint/build OK; Codex adversarial approve (no findings); Opus round 1 CHANGES (assertPotAddress accepted invalid values) → fixed → APPROVE.

## 2026-11-13 — lane/ui (Tasks 4.2–4.4, plain shadcn; design pass 4.1 pending Marco's bundle)
- Landed: /new create form (validateCreate), /pots/[potId] status (availableActions, PotActions, verified receipt, auto-finalize every 10s + button, organizer invite link), home, /sign-in (magic link), /join/[token] (server-side invite resolution). Conductor fixed globals.css --font-sans self-reference.
- Gates: vitest 223/223 (lane), tsc, lint, build OK; reviewer (Sonnet) APPROVE. Not yet exercised signed-in with real data (needs SMTP + Vercel env).

## STATE — 2026-11-13 ~01:50: all four lanes merged; lane workers stopped. Next: full-codebase multi-agent review, then Marco's morning items.

## STATE — 2026-11-13 (after usage reset): full-codebase review in progress
- All four lanes merged at 730c35f (+ b6a3d40 font fix). Lane workers stopped.
- Review workflow wf_4ab1801f-9e4 (6 dimensions, adversarial verify). First pass hit the usage limit; resumed with failed agents on Haiku (wallet-api finder + integration skeptics).
- Confirmed so far: (1) streams fold throws on huge deadline → whole batch 500s, can stall the Stream [medium]; (2) receipt_text not in Realtime publication / written after PayoutRequested, so members don't see it live [medium]; (3) organizer can swapSeat after members paid to dilute the objection electorate [low, needs Marco: contract]; (4) WindowField custom input vanishes mid-typing [low]; (5) swapped-out member's invite link leads to an unreadable pot [low]; (6) POT_ADDRESS not trimmed in chain.ts [low]; (7) prefund cap / rate limit in-memory per instance on Vercel [low].
- Next: wait for resume results → send fixes to lanes (Codex workers on gpt-6-luna, Claude reviewers on Haiku per Marco) → morning report.

## 2026-11-13 — lane/events-data (full-review fixes)
- Landed: fold clamps chain timestamps to 9999-12-31; per-pot isolation of deterministic fold errors (200, others still project; DB errors still 500); pot_meta in supabase_realtime + usePot listener (live receipt text); prefund_ledger + reserve_prefund/release_prefund (service_role only). Migrations 000300/000400 applied, db lint clean.
- Gates: vitest/tsc/lint/build OK (after refreshing stale worktree deps); reviewed by the conductor (Opus) — APPROVE. Worker: Codex gpt-6-luna.

## 2026-11-13 — lane/contract (POT_ADDRESS trim)
- Landed: POT_ADDRESS export trimmed (undefined when blank) + 2 tests. Web-only; Pot.sol untouched.
- Gates: lib/pot 9/9, tsc, lint, build OK; reviewed by the conductor (Opus) — APPROVE. Worker: Codex gpt-6-luna.
- In review: Lane 2 round 1 (shared Response in finalize single-flight; first-time organizer sign-in/claim broken) and Lane 4 round 1 (invite "left" state fired before Stream projection).

## 2026-11-13 — lane/ui (full-review fixes)
- Landed: non-interactive sign-in fallback; invite outcomes (left only for an inactive pot_members row; no row = still invited); custom window input latches; auto-finalize with deterministic 0–3 s jitter and one shared in-flight finalize per pot (button + auto tick).
- Gates: vitest/tsc/lint/build OK; conductor (Opus) review round 1 CHANGES (left-state fired before Stream projection) → fixed → APPROVE. Worker: Claude Haiku.

## 2026-11-13 — lane/wallet (full-review fixes)
- Landed: CircleTimeoutError → 502 TransactionPending with circleTransactionId; finalize single-flight per pot (cloned Response per caller); /api/wallet/me read-only; callback never provisions (claim is a no-op without a row); POST /api/pots provisions + links the organizer before createPot; stale (>120 s) wallet reservations taken over; prefund cap via Supabase reserve_prefund/release_prefund.
- Gates: vitest 267/267, tsc, lint, build OK on main; conductor (Opus) review round 1 CHANGES (shared Response body; first-time organizer sign-in + RLS link) → fixed → APPROVE. Worker: Codex gpt-6-luna (conductor committed; sandbox git lock).

## STATE — 2026-11-13: all full-review fixes merged. Open: contested seat-swap dilution (Marco), in-memory 5 pots/hour limiter (documented), Marco's account/env items.
