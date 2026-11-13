# Pot — design

**Date:** 2026-11-12
**Author:** Marco Garity (primary creator; every decision in this spec was approved by Marco)
**Brief:** [`docs/brief.md`](../../brief.md)
**Supersedes:** —

Pot is a commitment-pot smart contract for group bookings on Arc testnet. The organizer creates a pot with a total, a per-person share, a member list, a deadline, and an objection threshold. Each member pays their exact USDC share into `Pot.sol`. The pot locks only if every member pays by the deadline; otherwise everyone can refund. Once locked, the organizer requests payout with a receipt hash, which opens an objection window; if fewer than `threshold` members object, the organizer is paid. If the threshold is met or exceeded, the pot freezes and everyone refunds.

Submission target: **UBC 2026 hackathon**, Consumer track. Competing for Best use of Arc and the QuickNode Streams bounty. Deadline **Fri 2026-11-20, 1 PM ET**. Finals in person **2026-11-21**.

---

## Intent and the why

A real group booking (apartment, rental car, group ticket) has a trust problem: the organizer has to commit money before everyone has actually committed. "Reserve Now Pay Later" lets the organizer book, but the exposure is still theirs. Pot fixes that by holding every member's share *before* the organizer treats the booking as real. The invariant is: **nobody is in until their money is locked in.**

The product is also a hackathon submission under a specific constraint: Marco is the primary creator and every spec decision must be one he made. The committed design doc (this file) is part of the authorship record.

## Goals

- A working onchain commitment pot on Arc testnet (`Pot.sol`) deployed and verified on Blockscout.
- A working frontend on Vercel where an organizer creates a pot and members pay with a single tap (no seed phrases, no gas prompts).
- A live progress bar across all open browsers via Supabase Realtime, driven by a QuickNode Stream against the Pot contract.
- 21 Foundry tests plus one pre-test (test 0, decimals), all passing, written before implementation.
- A 2–3 minute demo video that shows the full happy path (create → pay → lock → request release → objection window closes → payout) within a demo-length objection window.
- README with: architecture, Pot contract address on Arc, Arc usage explanation, and the QuickNode Streams writeup (network, dataset, filter logic, destination, why).

## Non-goals

- Off-ramp to a bank (pitch slide only).
- Fee logic / revenue model (pitch slide only).
- AI agent features.
- Notifications beyond the live progress bar.
- Mainnet deployment.
- Direct-to-venue payment. Pot reimburses the organizer who booked; the pot *backs* the booking, it doesn't pay the venue.

## Anti-goals (would make this a failure even if it technically works)

- Copy-pasted Arc sample code. All implementation must be original work during the event.
- A custodial story that hides the custody. If developer-controlled wallets are used, the README states plainly that the *contract* — not the wallet — is what guarantees funds can't be moved early.
- A design where the QuickNode Stream filter requires tracking a dynamic set of contract addresses. The bounty writeup has to be a one-liner.
- Any path where Supabase diverges from chain state in a way that can't be rebuilt by re-running the Stream.

## Constraints

- **Hard deadline:** Fri 2026-11-20, 1 PM ET.
- **Arc testnet:** chain id 5042002, RPC `https://rpc.testnet.arc.io`, Blockscout explorer.
- **USDC is the gas token on Arc.** Native USDC uses **18 decimals**. The USDC ERC-20 interface's `decimals()` must be verified before any amount math — asserted in **test 0** (see Tests).
- **Mempool enforces a 20 Gwei `maxFeePerGas` floor.** Transaction sender code (Circle backend calls) must set `maxFeePerGas ≥ 20 Gwei`.
- **Transfers to `address(0)` revert on Arc.** `organizer != address(0)` enforced at `createPot`. Same guard for any address parameter on any function.
- **Toolchain:** Arc Foundry (`arc-forge`, `arc-cast`, `arc-anvil`).
- **Lane boundaries:** Only the conductor (Marco) edits `package.json`, lockfiles, and shared config. Each lane only touches files in the paths the brief assigns to it.
- **One worktree per lane**, created by the tool running the lane. No nested worktrees.
- **Nothing merges to `main` with failing tests.** Marco merges to main.

---

## Approaches

Architecture-level choices were made in the brief ([`docs/brief.md`](../../brief.md)) and are not re-litigated here. This section covers the seven decisions the brief left open, each with the alternatives considered, the trade-offs, and what was chosen.

### Decision 1 — Wallet custody

| Option | Pros | Cons |
|---|---|---|
| User-controlled (Circle UCW + Paymaster) | Pitch-perfect: nobody can move a member's money. Trust-less by default. | Circle UCW challenge/PIN flow on an unknown browser during a 2-min demo is real integration risk. |
| **Developer-controlled** *(chosen)* | Fastest to build, most forgiving demo. Zero wallet friction. | The app technically holds signing authority. Mitigation: README states plainly that funds are gated by the **contract**, not the wallet. |

**Chosen:** developer-controlled.

### Decision 2 — How a member pays

| Option | Pros | Cons |
|---|---|---|
| **Native USDC via `msg.value`** *(chosen, gated)* | One atomic tx per pay. Cheapest and simplest contract logic. Matches Arc's design where USDC is the gas token. | Depends on Arc exposing contract `receive()` / `payable` for USDC. Must be verified before committing. |
| ERC-20 `approve` + `safeTransferFrom` | Universally supported pattern. OpenZeppelin SafeERC20 handles every case. | Two txs per payer, ~2× latency on the live progress bar. Opens approve/pay race edges. |
| EIP-2612 `permit` + transferFrom | One tx, one signature. | Requires Arc's USDC to expose `permit`. Not confirmed; skip for hackathon risk. |

**Chosen:** native USDC via `msg.value`. **Gated on a day-1 verification spike** (Lane 1): deploy a trivial `payable` receiver on Arc testnet, `cast send` 1 USDC to it, confirm the contract's balance moved. If the spike fails, fall back to ERC-20 `approve + safeTransferFrom`; the rest of the contract design is unaffected.

### Decision 3 — Contract shape

| Option | Pros | Cons |
|---|---|---|
| **One `Pot.sol`, many pots by `potId`** *(chosen)* | One deployed address → one Blockscout link, one QuickNode Stream filter, one line in the README. Cheaper per-pot. Fits the 21 tests as-written. | Shared storage (minor; isolated by `potId`). |
| Factory deploys one `Pot` per pot | Per-pot isolation; `address(this).balance == pot.total` is a free invariant. | Multiple addresses to track, stream filter has to follow a dynamic set, two contracts to verify. Pure cost for an MVP. |

**Chosen:** one contract, pots keyed by `potId`.

### Decision 4 — Identity

| Option | Pros | Cons |
|---|---|---|
| **Supabase Auth owns the session; Circle is a backend wallet service** *(chosen)* | Supabase already in stack, magic-link setup is minutes. Auth not downstream of Circle SDK health. | Have to enforce email normalization (lowercase+trim at both insert and lookup) or risk duplicate wallets. |
| Circle's email auth owns the session | One less thing to build. | Session cookie now depends on Circle's SDK. Needless failure mode when Supabase is already present. |
| Third-party (Clerk, Auth0, NextAuth) | Standard. | Overkill for one email-login route. |

**Chosen:** Supabase Auth owns the session.

```sql
create table users (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          citext unique not null,     -- or text with a lower() unique index
  circle_user_id text,
  wallet_address text,
  claimed        boolean not null default false,  -- true after the invitee signs in
  created_at     timestamptz not null default now()
);
```

Circle provisioning is **eager at `createPot`**, not lazy: the server provisions a Circle developer-controlled user record for every invited email the moment the organizer submits the create form. This gives us real `address` values to pass into the contract's `members[]` array immediately, so the pot is fully onchain the second it's created and invite links point to a real `potId`.

A `users` row is written for each invited email with `claimed = false` and no `auth.users.id` link yet. When the invitee signs in later via Supabase magic link, we match on normalized email, set `claimed = true`, and link the Supabase auth row. The email-as-identity threat (an attacker claiming someone else's pre-provisioned wallet) is closed by magic-link auth: only the holder of the email can click the link.

### Decision 5 — Payout destination

| Option | Pros | Cons |
|---|---|---|
| **Pay the organizer** *(chosen)* | Matches the brief's own example (organizer books with their card, pot reimburses). Receipt-hash mechanism makes sense because the organizer is the one being paid. Works for any real-world venue. | None material for this MVP. |
| Pay a venue address set at creation | More literal "pay the venue" story. | Fiction without a real USDC-on-Arc venue; staged demo. Receipt hash loses its anchor. |
| `finalizeRelease(payoutTo)` chosen at release | Flexible. | Adds an objection vector ("destination changed") and UI surface for no MVP benefit. |

**Chosen:** pay the organizer (`organizer` stored at `createPot`, enforced `!= address(0)`).

### Decision 6 — Objection threshold

| Option | Pros | Cons |
|---|---|---|
| **Configurable count at `createPot`, bounded `1 ≤ threshold ≤ members.length`** *(chosen)* | Per-pot tunable. Organizer picks the group's risk tolerance. | One extra input to validate at creation. |
| Hardcoded simple majority | No parameter, auto-scales. | Not tunable; no "unanimous-minus-one" story. |
| Configurable fraction | Flexibility. | Basis-point math for no MVP gain. |
| Single objection freezes | Max member protection. | One grumpy member can block a legit booking; destroys the escrow story. |

**Chosen:** configurable count. Revert at `createPot` if `threshold < 1 || threshold > members.length`.

### Decision 7 — Seat swap timing

| Option | Pros | Cons |
|---|---|---|
| **Before lock only** *(chosen)* | Clean invariant: once locked, the member set is final. Simpler contract. Fits test 7 as a single assertion. | Member who must leave post-lock has to use object + refund + recreate the pot. |
| After lock, atomic | Models real life. | More contract state transitions, 2–3 extra tests, no demo moment to show it off. |
| After lock, non-atomic | — | Breaks the "money in == money out" invariant mid-sequence. Reject. |

**Chosen:** before lock only. Post-lock exits route through `object` + `refund`.

---

## The how (what the builder should build)

### Smart contract

**File:** `contracts/src/Pot.sol`

**Storage model (one `Pot.sol`, many pots by `potId`):**

```solidity
struct Pot {
    address organizer;         // payout destination; != address(0)
    uint256 total;             // share * members.length
    uint256 share;             // per-person USDC amount (18 decimals)
    uint256 deadline;          // unix seconds
    uint256 threshold;         // objections >= threshold => frozen; 1..members.length
    uint256 objectionWindow;   // seconds; set at create (e.g., 120 for demo, 48*3600 for prod)
    uint8   state;             // 0 Funding, 1 Locked, 2 PayoutRequested, 3 Released, 4 Frozen
    uint256 paymentsCount;
    uint256 objectionsCount;
    bytes32 receiptHash;       // set by requestRelease
    uint256 releaseEligibleAt; // block.timestamp + objectionWindow, set by requestRelease
    address[] members;
    mapping(address => bool) isMember;
    mapping(address => bool) hasPaid;
    mapping(address => bool) hasObjected;
}

mapping(uint256 => Pot) internal pots;
uint256 internal nextPotId;
```

**Functions (state transitions):**

| Function | Who | From state | To state | Notes |
|---|---|---|---|---|
| `createPot(total, share, members[], deadline, threshold, objectionWindow) → potId` | anyone | — | Funding | `msg.sender` is `organizer`. Validates: `members.length > 0`, `total == share * members.length`, `deadline > block.timestamp`, `1 ≤ threshold ≤ members.length`, no duplicate members, no `address(0)`. |
| `pay(potId) payable` | member | Funding | Funding or Locked | `msg.value == share`. Rejects double-pay, non-members, paying after deadline, wrong amount. Emits `Paid`. If `paymentsCount == members.length`, transitions to Locked and emits `Locked`. |
| `swapSeat(potId, leaver, replacement)` | organizer | Funding | Funding | Only before lock. Refunds `leaver` if paid; replaces in `members[]` and mappings. Emits `SeatSwapped`. |
| `refund(potId)` | any payer | Funding (after deadline) or Frozen | — | Sends `share` to the caller. Rejects double-refund, non-payers, before deadline (unless frozen). Emits `Refunded`. |
| `requestRelease(potId, receiptHash)` | organizer | Locked | PayoutRequested | Sets `receiptHash` and `releaseEligibleAt = block.timestamp + objectionWindow`. Emits `PayoutRequested`. |
| `object(potId)` | member | PayoutRequested (before `releaseEligibleAt`) | PayoutRequested or Frozen | Increments `objectionsCount`. Rejects non-members, double-objections, after window. If `objectionsCount >= threshold`, transitions to Frozen and emits (members may now `refund`). Emits `Objected`. |
| `finalizeRelease(potId)` | anyone | PayoutRequested (at/after `releaseEligibleAt`), objections below threshold | Released | Sends `total` to `organizer`. Emits `Released`. |

**Events (all indexed on `potId`):**
`Paid(potId, member, amount)`, `Locked(potId)`, `SeatSwapped(potId, leaver, replacement)`, `Refunded(potId, member, amount)`, `PayoutRequested(potId, receiptHash, releaseEligibleAt)`, `Objected(potId, member, objectionsCount)`, `Released(potId, organizer, amount)`.

**Imports:** OpenZeppelin `SafeERC20` (only if native-USDC spike fails and we fall back), `ReentrancyGuard` on state-changing external functions. No proxy, no upgradeability.

### Tests (Foundry, TDD — written before implementation)

**Test 0 (pre-list, decimals assertion):**
> `pay(share = 300 * 10^18)` with a 300 USDC payment records exactly `300 * 10^18` on the pot's state. Verifies the decimals model Arc uses.

**Tests 1–21: the brief's list, verbatim.** Marco owns this list; agents implement it.

1. All members pay, pot locks.
2. A finalized payout sends exactly the total.
3. Paying $300 records $300 (decimals are right).
4. Refund works after the deadline if the pot isn't full.
5. No refund before the deadline.
6. No double refund.
7. Seat swap works (before lock only).
8. Paying twice fails.
9. Paying the wrong amount fails.
10. A non-member can't pay.
11. The organizer can't withdraw early.
12. Paying after lock fails.
13. **Invariant:** money is never created or lost (fuzz, 10,000 runs).
14. Payout succeeds after the window with 0 objections.
15. Reaching the objection threshold blocks the payout (and transitions to Frozen).
16. No finalize before the window ends.
17. No double objection.
18. Non-members can't object.
19. Refund works after a blocked payout (Frozen state).
20. The last payment emits both `Paid` and `Locked`.
21. Only the organizer can request payout, and only after lock.

### Backend (Next.js route handlers)

- `POST /api/pots` — create pot. For each invited email: (1) upsert a `users` row with `claimed = false`, (2) provision a Circle developer-controlled user + wallet, (3) **pre-fund each wallet with ~$1 USDC gas allowance** from the treasury relayer wallet (see Infrastructure). Then: send `createPot` tx with the collected `address[]`, return `potId`.
- `POST /api/pots/[potId]/pay` — member pays: Circle sends `pay` tx with `msg.value = share` from the member's wallet.
- `POST /api/pots/[potId]/request-release` — organizer submits a free-form receipt string (URL, confirmation number, or short text). The server computes `receiptHash = keccak256(utf8(receipt_text))`, stores `receipt_text` in `pots`, and sends `requestRelease(potId, receiptHash)`.
- `POST /api/pots/[potId]/object` — member objects.
- `POST /api/pots/[potId]/finalize` — finalize release. **Signed by the treasury relayer wallet**, not a member wallet. Not required to be called by anyone specific onchain; this route exists as a manual trigger and as the client-side fallback (see cron below).
- `POST /api/pots/[potId]/refund` — payer refunds.
- `POST /api/pots/[potId]/swap` — organizer swaps a member before lock. Re-runs the eager-provision + pre-fund flow for the replacement.
- `POST /api/streams` — QuickNode Stream destination. Verifies the Stream security token; upserts each event into Supabase keyed on `(transaction_hash, log_index)` so retries and multi-event txs never double-count.

**Finalize cron.** A server cron (Vercel Cron or Supabase Edge Function on a schedule) polls `pots` for rows where `state = PayoutRequested AND release_eligible_at <= now() AND objections_count < threshold`, and triggers `finalizeRelease` via the relayer wallet. For the demo, the status page also triggers it client-side if a member views the pot past `release_eligible_at` — belt-and-suspenders in case the cron hasn't fired yet.

All server routes use the Supabase session cookie to identify the user, look up `circle_user_id`, and sign via Circle on their behalf (except `/finalize` and `/streams`, which use the relayer). All tx construction sets `maxFeePerGas ≥ 20 Gwei`.

### Database (Supabase)

Cache of chain state; rebuildable from a Streams backfill. Schema:

- `users` — see Decision 4.
- `pots` — one row per onchain pot, keyed by `pot_id`. Columns include `title`, `total`, `share`, `deadline`, `threshold`, `objection_window_seconds`, `organizer_address`, `state`, `receipt_text` (free-form, set at request-release), `receipt_hash` (keccak256 of `receipt_text`, mirrors onchain), `release_eligible_at` (timestamptz, set at request-release).
- `pot_members` — `(pot_id, address, email, has_paid, has_objected, is_organizer)`.
- `pot_events` — append-only, `(transaction_hash, log_index)` unique. Primary insert target of `/api/streams`.

Supabase Realtime is enabled on `pots`, `pot_members`, and `pot_events`. The frontend subscribes to the current pot's rows.

**State note (for Lane 1 implementers):** `has_paid` is **never cleared**. Objecting and refunding are independent flags. Refund eligibility is `has_paid == true AND state ∈ {Funding-past-deadline, Frozen}`. An objector can still refund in the Frozen state; objecting doesn't consume the payer's claim.

### Frontend (Next.js App Router)

- `/` — list of pots the current user is a member of or organizer of.
- `/new` — create pot form. Fields:
  - **Title** (text)
  - **Total USDC** (number) — share is derived as `total / members.length` and shown read-only
  - **Member emails** (dynamic list, at least one)
  - **Deadline** (datetime-local picker; must be > now)
  - **Objection threshold** (number; bounded `1 ≤ threshold ≤ members.length` with live validation)
  - **Objection window** (dropdown with presets: *"2 minutes (demo)"*, *"48 hours (production)"*, *"custom"*; custom field allows any value in `60s ≤ window ≤ 7 days`)
- `/pots/[potId]` — status screen: member list, who paid, live progress bar driven by Supabase Realtime, pay button (if member and not paid), request-release button (if organizer and locked), object button (if member and payout requested; **shows the raw `receipt_text` so members can see what they're objecting to**), refund button (when applicable). When viewed past `release_eligible_at` with objections below threshold, the page auto-triggers `/api/pots/[potId]/finalize` as a fallback to the cron.
- `/join/[inviteToken]` — invite flow for non-authenticated members. Clicking the link triggers Supabase magic-link email; on sign-in, the server links the Supabase auth row to the pre-provisioned `users` row for that email.

Claude Design produces the design system and screens, then hands off to Claude Code.

### Infrastructure (treasury & gas)

**Treasury relayer wallet.** A single server-held EOA (viem + an env-stored private key, or Circle developer-controlled "ops" wallet — Lane 2's call based on the spike) that:

1. Pre-funds each member wallet with **~$1 USDC** at Circle provision time, so the member can pay their own gas on `pay`, `object`, and `refund`.
2. Signs `finalizeRelease` (the cron trigger and the client fallback).
`createPot` and `swapSeat` are signed by the organizer's own Circle wallet, so `msg.sender` is the organizer. The relayer only pre-funds wallets and signs `finalizeRelease`. (Amended 2026-11-12, see Amendments.)

Pre-demo setup: load the relayer with ~**$20–50 testnet USDC**. Sized for ~20 member wallets × $1 each + ~$2 for finalize gas × a few runs.

**Paymaster optimization (deferred).** If the Lane 2 Circle-on-Arc spike confirms that Circle Paymaster works for developer-controlled wallets on Arc, Lane 2 may swap item (1) above for Paymaster sponsorship and skip per-wallet pre-funding. This is an optimization, not a dependency; the pre-fund model works regardless.

### QuickNode Stream (bounty writeup material)

- **Network:** Arc testnet (chain id 5042002).
- **Dataset:** receipts / logs.
- **Filter logic:** `address = <Pot contract address>` **AND** `topic0 IN (keccak(Paid), keccak(Locked), keccak(PayoutRequested), keccak(Objected), keccak(Released), keccak(Refunded), keccak(SeatSwapped))`. One address, finite topic list.
- **Destination:** `POST https://<vercel-url>/api/streams` with a shared security token header; the handler verifies the token, then upserts into Supabase keyed on `(transaction_hash, log_index)`.
- **Why:** Pot's product UX depends on sub-second progress-bar updates across all members' browsers. Polling the chain is wasteful and laggy; Streams gives us a push model with an idempotent landing zone (Supabase), which both powers Realtime and acts as a rebuildable cache of chain state.

---

## What's left to the builder

- Exact Foundry project layout within `contracts/` (`forge init`-style). The builder may choose.
- Supabase migration file names and ordering; the schema above is the target end-state.
- Next.js directory conventions within `web/app/`, choice between Server Components and client components per screen — builder's call, guided by the shadcn/ui patterns.
- Design-system specifics (colors, type, spacing). Claude Design produces these.
- Exact Circle SDK integration pattern; choose the simplest that lets the backend provision developer-controlled wallets and send signed transactions.

---

## Lanes (for the plan handoff)

The plan (written next, via `superpowers:writing-plans`) will be grouped by the four lanes from the brief:

| Lane | Owns | Owner tag in plan | Done when |
|---|---|---|---|
| 1. Contract | `contracts/`, `web/lib/pot/` (ABI + address export) | `owner: claude-code` (TDD); Codex reviews every diff | **Day-1 verification spike passes**, then test 0 + all 21 tests pass; `Pot.sol` deployed and verified on Arc testnet Blockscout |
| 2. Wallet | `web/lib/circle/`, `web/app/api/wallet/`, `web/lib/relayer/`, `web/app/api/pots/` | **`owner: codex`** | **Day-1 Circle+Arc spike passes** (dev-controlled wallet provisions on chain id 5042002 and sends a test tx); then test user signs in by email and sends a transaction on Arc testnet; relayer pre-fund flow works end-to-end |
| 3. Events + Data | `supabase/`, `web/app/api/streams/`, `web/lib/realtime/` | **`owner: codex`** | A test `Paid` event appears in Supabase and in an open browser within seconds |
| 4. UI | `web/app/(screens)/`, `web/components/` | `owner: claude-design` → `owner: claude-code` (from the design handoff) | Create, join, pay, and status screens run on real data |

Rules for every lane (from the brief, carried forward):
- Only touch files your lane owns. Ask for anything else in the lane summary.
- Only the conductor edits `package.json`, lockfiles, and shared config.
- One worktree per lane, created by the tool running the lane.
- Nothing merges to `main` with failing tests.

## Risks and mitigations

| Risk | Mitigation |
|---|---|
| Native USDC `msg.value` doesn't work on Arc as expected | Day-1 verification spike as Lane 1's first task; fall back to ERC-20 `approve + safeTransferFrom` with no change to lanes 2–4. |
| Circle developer-controlled wallets don't support Arc testnet (chain id 5042002) | Day-1 Circle+Arc spike as Lane 2's first task; fall back to a server-held EOA per user via viem + env-stored keys. Contract + lanes 1/3/4 unaffected. |
| Email-is-identity race (attacker tries to claim a pre-provisioned wallet) | Supabase magic-link auth gates the `claimed = true` flip; only the email holder can click the link. |
| Treasury relayer runs out of USDC mid-demo | Pre-load 2–3× expected spend ($20–50 testnet USDC); health-check endpoint in `/api/streams` writes a warning to logs if relayer balance drops below a threshold. |
| Finalize cron doesn't fire in time for the 2-min demo | Client-side fallback in `/pots/[potId]` auto-triggers `/finalize` if a member opens the page past `release_eligible_at`. |
| Circle SDK integration takes longer than expected | Developer-controlled wallets already chosen (faster path); no UI dependency on Circle browser SDK. |
| 2-min demo objection window doesn't give members time to see the request | `objection_window_seconds` is configurable at `createPot`; demo pots use 120s. UI auto-focuses the current state and surfaces `receipt_text` for members. |
| Stream misses events / Supabase drifts from chain | `/api/streams` upsert is idempotent on `(tx_hash, log_index)`; Streams backfill can rebuild Supabase from scratch. |
| QuickNode Stream filter has to track multiple contract addresses | One contract shape (Decision 3) makes the filter a single address + topic list. |
| Mempool rejects transactions under 20 Gwei `maxFeePerGas` | All server-side tx construction sets `maxFeePerGas ≥ 20 Gwei`. Verified in Lane 2. |
| Decimals mismatch causes amount bugs | Test 0 asserts the decimals contract, runs before any other test. |
| A member's address gets set to `address(0)` and transfers revert | Validated at `createPot`; same guard on `swapSeat(replacement)`. |

---

## Builder-check resolutions (2026-11-12)

A fresh builder reviewed this spec before approval and raised 8 questions. Resolutions, for provenance:

| # | Question | Resolution | Approved by |
|---|---|---|---|
| 1 | Plan both native-USDC and ERC-20 code paths? | No — native-USDC is the only planned path; ERC-20 is a gated fallback triggered *only* if the Lane 1 day-1 spike fails. | Marco (via the "my calls" review) |
| 2 | What's a "receipt hash"? | Free-form text from the organizer at `requestRelease`. Client hashes with `keccak256(utf8(text))`. Raw stored in `pots.receipt_text`, surfaced in the objection UI. | Marco |
| 3 | How do invitee emails become `address[]` at `createPot`? | **Eager Circle wallet provisioning** at pot creation for every invited email. `users` row written with `claimed = false`; magic-link sign-in flips it. See Decision 4. | Marco (chose "recommended") |
| 4 | Does Circle dev-controlled support Arc chain id 5042002? | Added **Lane 2 day-1 verification spike**. Fallback: server-held EOA per user via viem. | Marco |
| 5 | Gas funding for user wallets? | **Pre-fund each wallet with ~$1 USDC** from the treasury relayer at provision time. Circle Paymaster deferred as an optimization *if* the Lane 2 spike confirms it works for dev-controlled on Arc. | Marco (chose "recommended") |
| 6 | Form UX for deadline + objection window? | Deadline = datetime-local picker. Objection window = dropdown (*2min demo* / *48h prod* / *custom*); custom bounded `60s ≤ w ≤ 7d`. | Marco |
| 7 | Can a member both object and refund? | `has_paid` is never cleared. Objecting and refunding are independent flags. Objector can still refund in Frozen state. | Marco |
| 8 | Who pays gas for `finalizeRelease`? | A **server cron** watching `release_eligible_at` triggers it via the relayer wallet; client-side fallback in the status page as a safety net. | Marco |

## Submission checklist (hackathon requirements)

- [ ] Public repo.
- [ ] README with architecture.
- [ ] Pot contract address on Arc, verified on Blockscout.
- [ ] README section explaining how Arc is used.
- [ ] Working user-facing frontend.
- [ ] 2–3 minute demo video.
- [ ] README section for QuickNode Streams: network, dataset, filter logic, destination, and why.

## Amendments (2026-11-12, approved by Marco)

| # | Issue | Decision |
|---|---|---|
| A1 | Infrastructure said the relayer signs `createPot`, which would make the relayer `msg.sender` and therefore the organizer and payout recipient of every pot. | The **organizer's own Circle wallet signs `createPot`**. Contract unchanged (`organizer = msg.sender`). The relayer only pre-funds member wallets (organizer included) and signs `finalizeRelease`. |
| A2 | `web/app/api/pots/*` routes had no owning lane. | **Lane 2 (Wallet) owns `web/app/api/pots/`**: every route there signs via Circle or the relayer. |

## Amendments from the Codex review (2026-11-12, approved by Marco)

Source: [`docs/reviews/2026-11-12-codex-spec-plan-review.md`](../../reviews/2026-11-12-codex-spec-plan-review.md). These override the sections above where they conflict.

| # | Decision | Approved by |
|---|---|---|
| A3 | **Add `PotCreated(potId, organizer, members[], total, share, deadline, threshold, objectionWindow, requestWindow)`.** Includes the member list so Supabase's chain-derived tables can be rebuilt from events alone. Added to the Stream's topic list. | Marco |
| A4 | **Payout-request deadline.** `createPot` takes `requestWindow` (60 s to 30 days; UI presets 2 min demo / 7 days production). On lock the contract records `lockedAt`. If the organizer hasn't called `requestRelease` by `lockedAt + requestWindow`, anyone may call `expire(potId)`, which moves the pot to `Frozen` (refunds open) and emits `Expired(potId)`. Closes the "money stuck after lock" hole. | Marco |
| A5 | **Swapped-out addresses can't rejoin.** The contract tracks `wasMember` per pot; a replacement must never have been a member of that pot. A swapped-out payer is marked refunded and `paymentsCount` drops by exactly one. | Marco |
| A6 | **`users` keyed on an internal id.** `id uuid primary key default gen_random_uuid()`, `auth_user_id uuid unique null references auth.users on delete set null`, `email citext unique not null`, `circle_wallet_id text` (renamed from `circle_user_id`: it holds a Circle wallet id), `wallet_address text unique`, `claimed bool`. Deleting an auth user never erases a wallet mapping. Replaces the Decision 4 SQL. | Marco |
| A7 | **Abuse limits.** Contract: `members.length <= 20` and `share > 0`. API: at most 5 pot creations per user per hour; the relayer refuses pre-funding beyond `PREFUND_DAILY_CAP` (default 50 USDC). | Marco (cap of 20) |
| A8 | **Disjoint time intervals.** `pay` and `swapSeat` require `now < deadline`; deadline refunds require `now >= deadline`. `object` requires `now < releaseEligibleAt`; `finalizeRelease` requires `now >= releaseEligibleAt`. `expire` requires `now >= lockedAt + requestWindow`. Equality is tested at each boundary. | Review fix |
| A9 | **Verified platform facts (checked 2026-11-12).** Supabase's default SMTP only sends to project-team addresses, 2 per hour, so a custom SMTP provider is required for the demo. QuickNode Streams authenticate with HMAC-SHA256 over `nonce + timestamp + payload` using `X-QN-Nonce`, `X-QN-Timestamp` and `X-QN-Signature`; this replaces the "shared token header" wording. Vercel Hobby cron jobs run at most once a day, so finalize is triggered by the status page (retrying while eligible) plus a manual button; a per-minute cron only if the project moves to Pro. | Review fix |
| A10 | **Demo principal funding.** Pre-funding covers gas only. Before any demo, each demo wallet gets its share (plus gas) of testnet USDC from the treasury, via a conductor-run top-up script; the treasury is loaded from the Arc faucet with enough for all demo shares. | Review fix |
| A11 | **Rebuildable projection.** Chain-derived rows (`pots` state/counters, `pot_members` flags) are recomputed by folding *all* stored events for a pot in `(block_number, log_index)` order, so retries, partial failures and out-of-order delivery self-heal. Offchain metadata (title, invite token, emails, receipt text) lives in separate tables written only by the API. | Review fix |
| A12 | **Receipt text integrity.** `receipt_text` is saved only after `requestRelease` confirms, and the UI shows it only if `keccak256(receipt_text) == receipt_hash`. | Review fix |
| A13 | **Custody wording.** The README states that the backend holds signing authority for every member wallet (developer-controlled), and that the contract guarantees the organizer can't take money early; it does not claim protection against the operator. | Review fix |
