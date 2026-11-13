# Pot: brief for superpowers brainstorming

Read this whole file before asking anything. Most decisions are already made. Play them back to me in sections, then ask me only about the items under "Open decisions", one at a time. Save the approved design to `docs/superpowers/specs/` as usual, then hand off to writing-plans.

## What we're building

Pot is a commitment pot for group bookings. The organizer creates a pot. Each member pays their exact share in USDC into a smart contract on Arc. The pot locks only if every member pays by the deadline. If anyone misses it, everyone can take their money back. Once the pot is locked, the organizer requests payout with a receipt hash. That opens an objection window. If too few members object, the organizer is paid.

Example: Marco books a $2,400 Airbnb for 8 friends with Reserve Now, Pay Later. Each friend pays $300 into the pot by Jan 29.

One line: nobody is in until their money is locked in.

## Hackathon constraints

- UBC 2026 hackathon, Consumer track, competing for Best use of Arc and the QuickNode Streams bounty.
- Deadline: Fri Nov 20, 1 PM ET. Finals in person on Nov 21.
- All code is written during the event. Arc sample apps are reference only, never copied.
- Required: public repo; README with architecture; Pot contract address on Arc and how Arc is used; working user-facing frontend; 2 to 3 minute video.
- QuickNode bounty: at least one Stream with a filter and a destination, and a README section on network, dataset, filter logic, destination, and why.
- I am the primary creator. Every decision in the spec must be one I made or approved, and the spec records it.

## Core flow

1. The organizer signs in with email and creates a pot: title, total, per-person share, member emails, deadline.
2. The organizer shares an invite link.
3. Each member signs in with email, sees the pot, and taps Pay. No seed phrases and no gas prompts.
4. Everyone sees a live progress bar of who has paid.
5. If everyone pays by the deadline, the pot locks. If not, every payer can refund.
6. The organizer books, then requests payout with a receipt hash. The objection window starts: 48 hours in production, 2 minutes in the demo.
7. Window ends below the objection threshold: payout. At or above it: the pot freezes and everyone can refund.
8. Seat swap: a member can hand their seat to a replacement, who pays in; the leaver gets their share back.

## Contract: Pot.sol on Arc

Functions: `createPot(total, share, members, deadline)`, `pay`, `requestRelease(receiptHash)`, `object`, `finalizeRelease`, `refund`, `swapSeat`.

Events: `Paid`, `Locked`, `PayoutRequested`, `Objected`, `Released`, `Refunded`, `SeatSwapped`.

Rules:
- Funding is all or nothing: every member, exact share, before the deadline.
- The organizer cannot withdraw before lock plus a clean objection window.
- Money is never created or lost: total in equals total out.
- Objection window length is set at creation so the demo can use 2 minutes.

Tests, written first, in Foundry. I own this list; agents implement it.
1. All members pay, and the pot locks.
2. A finalized payout sends exactly the total.
3. Paying $300 records $300 (decimals are right).
4. Refund works after the deadline if the pot isn't full.
5. No refund before the deadline.
6. No double refund.
7. Seat swap works.
8. Paying twice fails.
9. Paying the wrong amount fails.
10. A non-member can't pay.
11. The organizer can't withdraw early.
12. Paying after lock fails.
13. Invariant: money is never created or lost (fuzz, 10,000 runs).
14. Payout succeeds after the window with 0 objections.
15. Reaching the objection threshold blocks the payout.
16. No finalize before the window ends.
17. No double objection.
18. Non-members can't object.
19. Refund works after a blocked payout.
20. The last payment emits both `Paid` and `Locked`.
21. Only the organizer can request payout, and only after lock.

## Arc facts to respect

- Arc testnet, chain id 5042002, RPC `https://rpc.testnet.arc.io`, Blockscout explorer.
- USDC is the gas token. Native USDC uses 18 decimals. Verify the decimals of the USDC ERC-20 interface before writing amount math.
- The mempool enforces a 20 Gwei `maxFeePerGas` floor.
- Transfers to `address(0)` revert.
- Toolchain: Arc Foundry (`arc-forge`, `arc-cast`, `arc-anvil`).

## Architecture

1. Browser: Next.js app on Vercel. Members sign in and approve transactions through Circle's web SDK.
2. Route handlers in the same Next.js app: create Circle users and transaction challenges, read and write Supabase. No separate server.
3. `Pot.sol` on Arc testnet: holds the money and enforces the rules. The only onchain piece and the source of truth.
4. QuickNode Stream: Arc testnet logs, filtered to the Pot contract address and its event topics, delivered to `POST /api/streams`.
5. `/api/streams`: checks the Stream's security token, then upserts each event into Supabase keyed on transaction hash plus log index, so retries and multi-event transactions never double count.
6. Supabase Realtime: pushes each new row to every open browser, which moves the progress bar.

Supabase is a cache of chain state. It can be rebuilt from a Streams backfill.

## Stack

| Layer | Choice |
|---|---|
| Contract | Solidity, Arc Foundry, OpenZeppelin (SafeERC20, ReentrancyGuard) |
| Chain | Arc testnet |
| Wallet | Circle user-controlled wallets, email sign-in, smart contract account with Circle Paymaster for gas |
| Frontend | Next.js App Router, TypeScript, Tailwind, shadcn/ui, viem for reads |
| Backend | Next.js route handlers |
| Database | Supabase Postgres and Realtime |
| Events | QuickNode Streams to `/api/streams` |
| Hosting | Vercel (public URL for the Stream) |
| Design | Claude Design: design system, then screens, handed off to Claude Code |

## Repo layout

```
contracts/   Foundry project: Pot.sol, tests, deploy script
web/         Next.js app, including web/app/api/*
supabase/    migrations and seed
docs/        superpowers specs and plans
AGENTS.md    shared rules for Claude Code and Codex
CLAUDE.md    imports AGENTS.md, plus Claude-only notes
```

## Lanes

| Lane | Owns | Built by | Done when |
|---|---|---|---|
| 1. Contract | `contracts/`, `web/lib/pot/` (ABI and address) | Claude Code, test-driven; Codex reviews every diff | All 21 tests pass; deployed and verified on Arc testnet |
| 2. Wallet | `web/lib/circle/`, `web/app/api/wallet/` | Codex | A test user signs in by email and sends a transaction on Arc testnet |
| 3. Events and data | `supabase/`, `web/app/api/streams/`, `web/lib/realtime/` | Codex | A test `Paid` event appears in Supabase and in an open browser within seconds |
| 4. UI | `web/app/(screens)/`, `web/components/` | Claude Design, then Claude Code from the handoff | Create, join, pay, and status screens run on real data |

Rules for every lane:
- Only touch files your lane owns. Ask for anything else in your summary.
- Only the conductor edits `package.json`, lockfiles, and shared config.
- One worktree per lane, created by the tool running the lane. Don't create nested worktrees.
- I merge to `main`. Nothing merges with failing tests.

## Out of scope for the MVP

- Off-ramp to a bank (pitch slide only).
- Fee logic. The business model is pitched, not built.
- AI agent features.
- Notifications beyond the live progress bar.
- Mainnet.

## Open decisions (ask me these, one at a time)

1. Wallet: user-controlled (preferred) or developer-controlled. Rule: if user-controlled can't send a test transaction within an hour of trying, switch and say so in the README.
2. How a member pays: native USDC sent with the call (one signature) or the USDC ERC-20 interface (approve, then pay). Check Arc's decimals for both first.
3. One contract holding many pots by id, or a factory that deploys one contract per pot.
4. Identity: how app sessions map to Circle users so a member signs in exactly once.
5. "Book with Pot": does `finalizeRelease` pay the organizer, or a venue address set at creation?
6. Objection threshold: a fixed count (5 of 8) or a fraction of members.
7. Seat swap: before lock only, or after lock too?
