# Pot

**Group payments that nobody can run off with.** A pot collects an equal share of USDC from everyone in a group. The money stays locked in a smart contract until the organizer asks for it, members get a window to object, and if the pot doesn't fill, everyone who paid gets their money back.

Built for the UBC 2026 hackathon (Consumer track) on **Arc testnet**, with **QuickNode Streams** driving the live progress bar.

| | |
|---|---|
| Contract | [`0xf842F699128A2e575d20BcC92F0472C7ad59e5C8`](https://explorer.testnet.arc.io/address/0xf842F699128A2e575d20BcC92F0472C7ad59e5C8) on Arc testnet (chain id 5042002), source verified on Blockscout |
| Live app | https://pot-pink.vercel.app |
| Demo video | > TODO before submit: link |

## How it works

1. The **organizer** signs in with an email, then creates a pot: a title, a total, the member emails (the share is `total / members`), a pay-in deadline, how many objections freeze the payout, and two time windows.
2. Each **member** signs in with their email from the invite link and taps **Pay**. No seed phrase, no wallet install, no gas prompt.
3. **Everyone watches the progress bar fill** in real time.
4. If **everyone pays by the deadline**, the pot locks. If not, every member who paid can refund.
5. Once locked, the organizer **requests the payout** with a receipt hash (what the money was spent on). A request window applies: if the organizer never asks, anyone can expire the pot and everyone refunds.
6. The **objection window** opens (48 hours in production, 2 minutes in the demo). Each member can object once.
7. When the window ends:
   - **Objections below the threshold:** anyone can finalize and the full total goes to the organizer.
   - **Objections at or above the threshold:** the pot freezes and every member who paid can refund.

A seat swap lets the organizer replace a member (for example, someone who can't pay) before the pot locks. If the leaver had already paid, they are refunded in the same call.

## Architecture

```
 Browser (Next.js on Vercel)
    │  sign in by email (Supabase Auth: a one-time code typed into the page, link as a fallback)
    ▼
 Route handlers  /api/pots/*  /api/wallet/*
    │  server maps email → Circle developer-controlled wallet,
    │  simulates the call, then signs it through Circle
    ▼
 Pot.sol on Arc testnet  ◄── the only onchain piece, the source of truth
    │  emits PotCreated, Paid, Locked, SeatSwapped, Refunded, PayoutRequested,
    │  Objected, Released, Expired, Frozen
    ▼
 QuickNode Stream  (Arc testnet logs filtered to the Pot address)
    │  POST, authenticated with a security token
    ▼
 /api/streams ──► Supabase Postgres (events + projected pot state)
                        │
                        ▼  Supabase Realtime
                  every open browser moves its progress bar
```

- **The contract is the source of truth.** Supabase is a cache of chain state, rebuilt by folding every stored event for a pot in `(block_number, log_index)` order. Events are stored keyed on transaction hash and log index, so Stream retries and multi-event transactions never double count.
- **Off-chain metadata** (pot title, invite token, invite emails, receipt text) lives in separate tables written only by the API. The UI shows receipt text only if its `keccak256` matches the hash recorded onchain.
- **One contract holds many pots**, addressed by pot id. There is no factory.
- **Payment path:** members pay with native USDC sent along with the call (one transaction). On Arc, USDC is the gas token and native amounts use **18 decimals**, while the ERC-20 interface reports 6. The contract works in native units and a test pins that $300 in records $300.

### Wallets and gas

Members never see a wallet. Each email is mapped to a **Circle developer-controlled EOA wallet** on `ARC-TESTNET`, created on first use and signed server-side through Circle. A **treasury wallet** (also a Circle developer-controlled wallet, not a raw key) tops up each member wallet with a small amount of USDC for gas, under a daily cap enforced in Supabase. The same treasury submits `finalizeRelease` once a window ends. Before a demo it also funds each demo wallet with its share (`scripts/fund-demo.mjs`).

Because Circle's gas estimation hides revert reasons, the server first simulates every call from the caller's address with viem to get the contract's custom error, then submits through Circle.

> **Custody:** the backend holds signing authority for every member wallet. The contract guarantees the organizer can't take the money early or skip the objection window. It does **not** protect against the operator of this backend.

## Smart contract

`contracts/src/Pot.sol` (Solidity ^0.8.24, OpenZeppelin `ReentrancyGuard`, built and tested with Arc Foundry).

| Function | Who | What |
|---|---|---|
| `createPot` | anyone (becomes organizer) | opens a pot: 1–20 unique members, exact share, future deadline, threshold, windows |
| `pay` | a member | exactly one share, before the deadline. The last payment locks the pot (`Paid` + `Locked`) |
| `swapSeat` | organizer | replaces a member before lock, refunding them if they paid |
| `refund` | a paying member | after the deadline if the pot didn't fill, or any time once frozen |
| `requestRelease` | organizer | after lock: records the receipt hash and starts the objection window |
| `object` | a member | one objection per member during the window; reaching the threshold freezes the pot |
| `finalizeRelease` | anyone | after the window: sends the full total to the organizer |
| `expire` | anyone | if the organizer didn't request payout in time: freezes the pot so payers can refund |

The full function-by-function walkthrough, with who may call each and which tests cover it, is in [`docs/contract-walkthrough.md`](docs/contract-walkthrough.md).

**Tests:** the 21 numbered tests from the product brief (their numbers are in the test names), extra cases for creation limits, seat swaps, expiry, rejecting and re-entrant receivers, and fuzzed invariants (money is never created or lost; a released pot pays exactly its total).

## QuickNode Streams

The **Stream** watches Arc testnet logs, filtered to the Pot contract address and its event topics, and delivers them to `POST /api/streams`. The route checks the Stream's security token, decodes each log against the contract ABI, and writes it to Supabase in one atomic projection step, so a replay is idempotent.

**Backfill and local testing.** Supabase is only a cache of chain state, so it can always be rebuilt. `scripts/replay-stream.mjs` reads the Pot contract's past logs from Arc testnet and POSTs them to `/api/streams`, signed the way QuickNode signs them. Replays are idempotent, so running it twice changes nothing. It needs the same `QUICKNODE_STREAM_TOKEN` as the target server:

```bash
node scripts/replay-stream.mjs --dry-run                                  # count what would be sent
QUICKNODE_STREAM_TOKEN=... node scripts/replay-stream.mjs --url https://<your-app>/api/streams
```

Script tests: `node --test scripts/*.test.mjs`.

**Stream configuration** (created and tested with `scripts/quicknode-stream.mjs`):

| Setting | Value |
|---|---|
| Network and dataset | `arc-testnet`, `logs` |
| Filter | a JavaScript function that keeps only logs whose address is the Pot contract and returns `null` (no delivery) for every other block |
| Batching | Elastic batching, 5 blocks per delivery or the plan's maximum if that is lower (1 on the free plan, which the script detects and applies). Arc's blocks arrive faster than one a second, and QuickNode asks for a batch of at least 5 for Streams that follow the chain tip on such networks |
| Destination | webhook to `POST /api/streams` on the deployed app, with QuickNode's auto-generated security token |
| Start | the chain tip. History is rebuilt with the replay script above |

The filter was tested on QuickNode's own filter-test endpoint against a real block holding two Pot events in one transaction (`Paid` and `Locked`). It returned exactly those two logs with every field the route decodes.

```bash
node scripts/quicknode-stream.mjs test              # run the filter on QuickNode against a real block
node scripts/quicknode-stream.mjs create --url https://<your-app>/api/streams          # dry run
node scripts/quicknode-stream.mjs create --url https://<your-app>/api/streams --yes    # create it
node scripts/quicknode-stream.mjs status
```

`create` saves the generated security token to `web/.env.local` as `QUICKNODE_STREAM_TOKEN` without printing it, and needs `QUICKNODE_API_KEY` there too. The API key is only for this setup and is not needed on Vercel.

**Live verification (2026-11-16).** The Stream is named `pot-events` (id `a7e51fb2-c47b-4e5f-ae70-9cbce90119df`) and delivers to the deployed app. A pot was created and driven through its whole life through the deployed app with no replay and no manual posting to the route. All seven events were delivered by the Stream and stored:

| Event | Stored by the time the app's own response returned |
|---|---|
| `PotCreated` | yes |
| `Paid` (3 members) | yes, each |
| `Locked` | yes |
| `PayoutRequested` | yes |
| `Released` | yes |

No `(transaction hash, log index)` pair was stored twice, and the pot's row ended in state *Released* with 3 payments. The projected pot row can trail the event row by a moment, because the route stores events first and then refolds the pot.

The route accepts the Stream's body as a bare array of logs or wrapped as `{ "data": [...] }`, and when it rejects a payload it logs only the payload's structure, never its contents. A first live delivery was rejected before this was added, which taught us that our own copy of QuickNode's format had differed from the real one. QuickNode stopped the Stream after repeated rejections, and `node scripts/quicknode-stream.mjs activate` restarts it.

> TODO before submit: add a screenshot or terminal capture of the Stream's delivery log (or the progress bar moving) to the repository.

## Running it locally

Prerequisites: a current Node.js LTS, Arc Foundry (`arc-forge`), a Supabase project, a Circle developer account (API key, entity secret, a wallet set and a treasury wallet), and an Arc testnet RPC.

```bash
# contracts
cd contracts
arc-forge test

# web app
cd web
npm install
cp .env.example .env.local     # then fill in the values below
npm run dev                    # http://localhost:3000
npm test                       # vitest
npm run build
```

Apply the SQL files in `supabase/migrations/` to your Supabase project in order.

Environment variables (`web/.env.example`):

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser-safe Supabase access (reads and Realtime, protected by row-level security) |
| `SUPABASE_SECRET_KEY` | server-only writes. Never expose it to the browser |
| `CIRCLE_API_KEY`, `CIRCLE_ENTITY_SECRET`, `CIRCLE_WALLET_SET_ID` | Circle developer-controlled wallets |
| `CIRCLE_TREASURY_WALLET_ID`, `TREASURY_ADDRESS` | the gas and finalize treasury |
| `PREFUND_DAILY_CAP` | daily cap on gas top-ups |
| `NEXT_PUBLIC_POT_ADDRESS`, `POT_DEPLOY_BLOCK` | the deployed contract and its first block |
| `QUICKNODE_STREAM_TOKEN` | authenticates the Stream's webhook calls |
| `QUICKNODE_API_KEY` | only for `scripts/quicknode-stream.mjs` (creating and restarting the Stream). Keep it in `web/.env.local`; the deployed app does not need it |
| `NEXT_PUBLIC_APP_URL` | optional: the app's public URL. If unset, the app uses the address it is served from (sign-in links) |

Secrets live only in `.env.local` (git-ignored) and in the Vercel project settings. The contract deploy key is local to `contracts/.env` and is never deployed.

### Demo funding

Before a demo, give each demo wallet its share. The script defaults to a dry run:

```bash
node scripts/fund-demo.mjs --email one@example.com --email two@example.com --email three@example.com --amount 2
node scripts/fund-demo.mjs --to 0xMemberOne --to 0xMemberTwo --to 0xMemberThree --amount 2    # or by wallet address
node scripts/fund-demo.mjs --email ... --amount 2 --yes     # actually send
```

Re-running the same recipient and amount on the same day is deduplicated by Circle, which makes a retry after a failure safe. To deliberately fund the same wallet again that day, add `--run-id <any new text>`. Script tests: `node --test scripts/*.test.mjs`.

## Repository layout

```
contracts/   Foundry project: Pot.sol, tests, invariants
web/         Next.js app (App Router, TypeScript, Tailwind, shadcn/ui, viem)
  app/api/     route handlers: pots, wallet, streams
  lib/         pot ABI and chain config, Circle and relayer helpers
supabase/    migrations
scripts/     demo funding, event replay (backfill), QuickNode Stream setup, test-data cleanup
docs/        brief, approved design spec and amendments, handoffs, merge log
```

## Known limitations

These are accepted on purpose for the hackathon build; details in [`docs/known-limitations.md`](docs/known-limitations.md).

- **Stuck-organizer payout:** if the organizer's address refused the payout transfer, the pot would stay in *Payout requested*. The app can't reach this, because every organizer is a Circle EOA wallet. The same applies to a member whose address rejects a refund.
- **Late payout request:** after the request window ends, the organizer can still request the payout until someone calls `expire`. Members keep their objection veto.
- **No contract-level deadline cap:** the app and API cap deadlines at 365 days; the contract itself does not.
- **Seat swaps after others have paid** can change who is allowed to object. Paid members' money is never at risk.
- **Custody:** see above. The operator can sign for member wallets.
- **Rate limits** on pot creation are counted per server instance.
- **Testnet only.**

The contract was reviewed independently three times: a model reviewer during development, an adversarial Codex review, and a separate security review in Cursor (`docs/handoffs/contract-cursor-review.md`, with our triage of each finding). The Cursor review found no way for anyone to take funds from a pot. It rated one finding High (a pot whose organizer is a smart contract that rejects payments can get stuck, which the app cannot create because every organizer is a Circle EOA wallet) and gave three lower findings; all four are listed in the limitations above. We chose not to redeploy the contract for them; see spec amendment A17.

## How this was built

The product brief, the approved design spec and its numbered amendments (A1–A16) are committed in `docs/` as the record of the product decisions. The work was split into four lanes (contract, wallet, events and data, UI), each in its own git worktree with its own handoff notes. See `AGENTS.md` for the lane rules and `docs/merge-log.md` for what landed and which checks it passed.
