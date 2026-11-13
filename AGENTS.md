# Pot: shared rules for Claude Code and Codex

Source of truth: docs/brief.md (product) and docs/superpowers/specs/2026-11-12-pot-design.md (approved design).
Marco is the primary creator. He makes product decisions; agents propose and build. Marco merges to main.

## Ground rules
1. Don't state what's current (models, tool versions, packages, chain settings) from memory.
   Check with a command or the docs, or say you don't know. Opus 5.5 exists.
2. Each lane touches only the files it owns. Only the conductor edits package.json,
   lockfiles, and shared config (tsconfig, next.config, foundry.toml, tailwind, eslint, .env.example).
3. Nothing merges to main with failing tests.
4. Arc sample apps are reference only. Never copy code from them.
5. One worktree per lane, created by the tool running the lane. No nested worktrees.

## Lanes
| Lane | Owns | Built by | Done when |
|---|---|---|---|
| 1. Contract | contracts/, web/lib/pot/ | Claude Code (TDD); Codex reviews every diff | Native-USDC spike done; test 0 + 21 tests pass; deployed and verified on Arc testnet |
| 2. Wallet | web/lib/circle/, web/lib/relayer/, web/app/api/wallet/, web/app/api/pots/ | Codex | Circle+Arc spike passes; a test user signs in by email and sends a tx on Arc testnet |
| 3. Events + Data | supabase/, web/app/api/streams/, web/lib/realtime/ | Codex | A test Paid event shows up in Supabase and an open browser within seconds |
| 4. UI | web/app/(screens)/, web/components/ | Claude Design → Claude Code | Create, join, pay and status screens run on real data |

Each lane also owns its own docs/handoffs/<lane>.md.

## Arc facts (verify before relying on them)
Arc testnet, chain id 5042002, RPC https://rpc.testnet.arc.io. USDC is the gas token (native = 18 decimals;
check the ERC-20 decimals()). maxFeePerGas floor is 20 Gwei. Transfers to address(0) revert.

## Handoffs
When you finish a task, append to docs/handoffs/<lane>.md: done, files changed, blockers,
anything another lane needs. Before starting, pull main and read the other lanes' handoff files.
