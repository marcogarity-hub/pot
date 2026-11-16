# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Judges first (confirmed 2026-11-16).** Hackathon judges for the UBC 2026 Consumer track (Best use of Arc, QuickNode Streams bounty) who see a 2 to 3 minute demo video and then the live finals on Nov 21. They need to grasp the product and see it work within seconds.
- **The people the product is for.** A group organizer and friends splitting a shared booking, for example one organizer fronting a $2,400 Airbnb for 8 friends. Members are invited by email, sign in with Google or an emailed code, and never see a wallet, seed phrase, or gas prompt.
- Mostly phones. Members open an invite link and act once or twice: pay, object, claim a refund.

## Product Purpose

Pot is a commitment pot for group bookings: **nobody is in until their money is locked in.** Each member pays an equal share in USDC into a smart contract on Arc. The pot locks only when every member has paid by the deadline. If not, everyone who paid can refund. After the organizer books, they request the payout and members get an objection window to veto it. Success is a group paying in, seeing live progress, and the money moving with nobody having to trust the organizer.

## Positioning

An all-or-nothing escrow with a member veto, run through ordinary sign-in. Members get a managed wallet automatically (Circle developer-controlled), USDC is both the payment and the gas token on Arc so members hold nothing else, and live progress comes from QuickNode Streams delivering contract events into the database. Splitwise or Venmo style apps track who owes money; Pot actually holds it until the group is committed.

## Operating Context

- Runs on Arc **testnet** with test USDC only. The demo is 3 members paying 2 USDC each with 2-minute demo windows; production windows are meant to be 48 hours.
- Live app: https://pot-pink.vercel.app (Next.js 16, Tailwind, shadcn/ui, Supabase, Vercel). Contract `Pot.sol` is deployed and fixed; it will not be redeployed.
- Walkthrough for the demo: organizer creates a pot, members open the invite link and pay, the progress bar moves on its own, the pot locks, the organizer requests payout with a receipt, the objection window counts down, then the payout finalizes (an open pot page finalizes automatically) or, on enough objections, the pot freezes and everyone refunds.

## Capabilities and Constraints

Features that exist today (all other features must not be shown):

- Sign in with Google or an emailed code (email delivery is currently unreliable; Google works).
- Create a pot: title, total, member emails, deadline (max 365 days), objection threshold, request and objection windows (2-minute demo presets exist).
- Invite link per pot; members join by opening it. Organizer can swap an unpaid member's seat.
- Pay a share, live progress bar, lock at full payment, expire after the request window.
- Organizer requests payout with receipt text; members can object; finalize (auto from an open pot page, or by button); refund when funding fails, the pot expires, or it freezes.
- Pot states shown to users: Funding, Locked, Payout requested, Released, Frozen, Expired. Terms: pot, share, member, organizer, request window, objection window, objection threshold, receipt.
- A pot list per user (with state, paid count, organizer flag) and per-pot event history (`pot_events`, readable by participants under RLS).
- Not available, so never designed in: wallet balance (the wallet API returns only the address), push or email notifications, chat, comments, fiat payments, multi-currency, profile pages.

Constraints: keep every API contract and behavior; 523 vitest tests exist and are updated, not deleted; the contract is fixed (no on-chain changes); the work ends Thursday 2026-11-19 so Friday is for QA and the video.

## Brand Commitments

The name is **Pot**. The current "P" mark in a circle is not binding. Marco will bring his own example references; none are binding yet.

## Evidence on Hand

Real data on the live app: demo pots 0 to 3 and QA pot 2 on Arc testnet (all test USDC), a verified contract at `0xf842F699128A2e575d20BcC92F0472C7ad59e5C8`, QuickNode Stream `pot-events`, live QuickNode deliveries. No customers, testimonials, press, or real-money usage exist, and none may be implied.

## Product Principles

1. **Show the money's state before anything else.** Locked, pending, released and refunded are the facts people open the app for.
2. **One next action per pot.** Every pot tells its viewer the single thing they can do now, or that they are waiting.
3. **Trust through legibility.** The guarantees (can't be paid out early, members can veto, refund if it doesn't fill) are visible in the interface, not buried in copy.
4. **No crypto vocabulary for members.** Gas, hashes and wallets stay out of the main path; explorer links are available for those who want proof.
5. **Honest about testnet.** Test money is labeled as test money.

## Accessibility & Inclusion

Mobile-first at 390px, keyboard operable with visible focus, WCAG AA contrast, form errors announced, state conveyed by text and not color alone.
