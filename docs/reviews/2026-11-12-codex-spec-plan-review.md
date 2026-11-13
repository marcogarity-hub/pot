No files changed. All 21 numbered tests have plan tasks, and the submission checklist is covered by Tasks 1.7, 3.4 and 4.5. The problems are in the proposed behavior and verification.

References: [Spec](</Users/marcogarity/Documents/Pot App/docs/superpowers/specs/2026-11-12-pot-design.md>), [Plan](</Users/marcogarity/Documents/Pot App/docs/superpowers/plans/2026-11-12-pot.md>), [Brief](</Users/marcogarity/Documents/Pot App/docs/brief.md>), [Rules](</Users/marcogarity/Documents/Pot App/AGENTS.md>).

1. **Blocker — Locked funds have no timeout.**  
   **Spec:** Smart contract, Decision 7; **Plan:** 1.5. If everyone pays and the organizer never requests release, nobody can object, finalize or refund. “Post-lock exits route through object + refund” also requires the organizer to request release and enough members to object. **Fix:** add a release-request deadline and permissionless transition to refunds after organizer inactivity; test it.

2. **Blocker — Swap accounting is incomplete.**  
   **Spec:** storage, `swapSeat`, Database state note; **Plan:** 1.4. Alice pays, is swapped out and refunded, then becomes a replacement again. Her permanent `hasPaid=true` either prevents repayment or, if treated as funded, credits a seat without new money. Refunding solely because `hasPaid` remains true can pay her twice from other pots. The spec also omits refund-tracking storage. **Fix:** define payment/refund history explicitly; for the MVP, reject previously used replacement addresses, mark swap refunds consumed, and decrement the active paid count exactly once. Preserve the plan’s post-deadline swap prohibition in the spec.

3. **Blocker — The conservation invariant does not establish solvency.**  
   **Brief:** Contract rule/test 13; **Plan:** 1.6. Global `balance == ghost_in - ghost_out` can pass while one pot spends another pot’s funds, provided the handler records that withdrawal. Conversely, unsolicited USDC breaks strict equality with method-tracked deposits; Arc permits qualifying `SELFDESTRUCT` transfers. **Fix:** assert per-pot deposits, withdrawals and outstanding liabilities, plus `balance >= aggregate liabilities`; track surplus separately. Literal “total in equals total out” holds only after settlement, excluding surplus and external transaction fees. [Arc semantics](https://docs.arc.io/build/evm-differences)

4. **Blocker — Event insertion and projection are not atomic.**  
   **Plan:** 3.2–3.3. Insert `pot_events`, then fail updating the member: the retry sees a duplicate and permanently skips the missing update. Concurrent payments can also overwrite each other’s read-modify-write counter increments. **Fix:** transact event insertion and projection together in Postgres, with row locking or atomic counters. Test failure between writes and concurrent deliveries.

5. **Blocker — Member principal is never funded.**  
   **Spec:** Backend, Infrastructure; **Plan:** 2.3–2.5, 4.5. Provisioning supplies approximately $1 for gas; a newly created wallet cannot pay a $300 share. The wallet spike funds only its test wallet. **Fix:** add an explicit testnet principal-funding procedure, balance checks and sufficient faucet funding before the demo. Distinguish this from the gas allowance.

6. **Major — Backfill cannot rebuild the promised cache. My A3 vote: approve, with changes.**  
   **Spec:** Anti-goals, Database; **Plan:** Pending decision, 2.4, 3.2. Proposed `PotCreated` omits members; events cannot recover emails, title, invite token or receipt text. A replayed creation also cannot satisfy `invite_token NOT NULL` without metadata. **Fix:** emit members or specify an RPC hydration step; preserve offchain metadata separately from rebuildable projections. Approve A3 before freezing the ABI. Reject the suggested `nextPotId` pre-read: it races and currently has no getter.

7. **Major — Projection rules do not reproduce swaps or ordered counters.**  
   **Plan:** 3.2, 2.5. Paid Alice leaves, replacement pays: the projector increments twice without decrementing for Alice. It neither activates the replacement nor records the swap refund; direct onchain swaps bypass the route’s replacement-row insertion entirely. Older `Objected` events can overwrite newer counts. **Fix:** replay canonical event order and project complete membership/refund transitions; test reordered swaps, payments and objections.

8. **Major — Provisioning and creation lack durable retry semantics.**  
   **Plan:** 2.3–2.4. Two simultaneous `ensureUser` calls can create and fund different wallets before the email uniqueness constraint rejects one insert. A confirmed pot followed by a database failure leaves an onchain pot the application cannot recover reliably. **Fix:** persist provisioning/creation intents, serialize provisioning per normalized email, use stable Circle idempotency keys, and reconcile confirmed transactions. Sequential mock calls do not test this.

9. **Major — The identity schema needs correction, but email should not be the primary key.**  
   **Spec:** Decision 4; **Plan:** 3.1. The spec’s mandatory Auth-linked primary key contradicts pre-provisioning. The proposed email primary key couples wallet identity to a mutable address; `ON DELETE CASCADE` can erase a funded wallet’s mapping when Auth deletes a user. **Fix:** use a generated internal UUID, nullable unique `auth_user_id`, unique normalized email, and retain the wallet mapping on Auth deletion. Rename `circle_user_id` to `circle_wallet_id`: Task 2.2 stores a wallet ID.

10. **Major — Join flow conflicts with RLS; user-table protection is unspecified.**  
    **Plan:** 3.1, 4.4. A signed-out visitor cannot look up `invite_token` under authenticated-only pot policies, so cannot obtain the proposed redirect’s `potId`. RLS is specified for three tables but not `users`. **Fix:** preserve `/join/[token]` through sign-in, then resolve it under membership authorization. Specify own-user read policies and server-only writes; test organizer access when the organizer is not a paying member.

11. **Major — Receipt text can diverge from its onchain commitment.**  
    **Spec:** Backend request-release; **Plan:** 2.5. Writing `receipt_text` before a transaction succeeds allows a failed or repeated request to overwrite the text members see while the contract retains the original hash. **Fix:** authorize organizer/state first, persist pending text, publish only the confirmed matching commitment, and verify the displayed text hashes to `receipt_hash`.

12. **Major — Several interfaces do not connect as written.**  
    **Plan:** 0.2, 2.2, 2.4, 3.1–3.4, 4.2.
    - `callPot` returns only `txHash`; creation expects receipt logs. Return a receipt or explicitly fetch it.
    - `PotStore` has no pot/member upsert operations although projection requires them.
    - The server Supabase factory is synchronous, while the current Next.js cookie setup requires asynchronous access. Update producers and consumers together. [SSR guide](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
    - Decoded `bigint` values cannot be inserted directly into JSONB through JSON serialization. Define decimal-string IDs/amounts, timestamp conversions and row types.
    - UI `emails`/`windowSeconds` differ from API `memberEmails`/`objectionWindowSeconds`; specify the adapter.

13. **Major — Public provisioning exposes the treasury.**  
    **Plan:** 2.3–2.5; **Spec:** creation validation. An authenticated attacker can repeatedly invite fresh emails, obtaining funded wallets. Unlimited member lists amplify this before contract creation; zero-share pots are also permitted by contract validation. **Fix:** require positive amounts, cap membership and provisioning spend, rate-limit creation/swaps, and prevent concurrent finalize requests from submitting redundant treasury transactions.

14. **Major — Failed payout receivers can strand funds.**  
    **Spec:** `finalizeRelease`, `refund`, `swapSeat`; **Plan:** 1.4–1.5. A contract organizer whose receiver reverts prevents release forever, while members remain unable to refund. A rejecting member cannot receive their refund. **Fix:** define a safe failed-payout recovery or authorized withdrawal-address mechanism. Test rejecting and reentering receivers. Prescribed `nonReentrant` plus checks-effects-interactions addresses ordinary reentrancy on paper; receiver failure remains a liveness problem.

15. **Major — Deadline equality needs an explicit contract rule.**  
    **Spec:** state transitions; **Plan:** 1.3–1.5. Tests cover `deadline + 1`, not equality. If payment accepts `timestamp == deadline` while refunds also start then, a refund followed by the last payment can lock an underfunded pot because payment history remains set. **Fix:** specify disjoint intervals—payment/swap before deadline, expiry refunds at/after it—and test both transaction orders. The specified objection/finalize boundary already uses coherent `<`/`>=`; test exact equality there too.

16. **Major — Custodial authority weakens the stated guarantee.**  
    **Spec:** Decision 1, Anti-goals; **Plan:** 4.5 README. The backend controls every member key, so it can manufacture threshold objections and execute refunds, or replace members before lock. The contract does not distinguish those actions from user consent. **Fix:** retain the approved developer-controlled choice, but describe guarantees against organizer misuse accurately and disclose the backend’s signing authority.

17. **Major — The wallet spike proves too little; fallbacks change other lanes.**  
    **Spec:** Risks; **Plan:** 1.1, 2.1–2.2. A native transfer does not prove payable contract execution, revert decoding or receipt handling. Waiting specifically for `CONFIRMED` can hang on Arc, which can transition directly to `COMPLETE`. Circle lists `ARC-TESTNET`, but uses native-token `amount` and fee fields such as `maxFee` in Gwei—not viem’s raw fields. **Fix:** spike an actual payable call through Circle through terminal success and failure. Replan cross-lane work if falling back: ERC-20 changes amounts/approval orchestration; EOA custody adds schema and secret-management requirements. [Circle chains](https://developers.circle.com/wallets/supported-blockchains), [execution API](https://developers.circle.com/api-reference/wallets/developer-controlled-wallets/create-developer-transaction-contract-execution), [states](https://developers.circle.com/api-reference/wallets/transaction-states-and-errors)

18. **Major — Email setup is missing from the critical path.**  
    **Plan:** 0.2, 2.3, 4.4. Supabase’s default SMTP restricts recipients to project-team addresses and currently allows two messages per hour; the multi-member demo can fail before payment. **Fix:** configure custom SMTP, redirect allowlists and session refresh, then test the actual demo addresses immediately. [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp)

19. **Major — QuickNode authentication contradicts the spec’s header description.**  
    **Spec:** QuickNode Stream; **Plan:** 3.3–3.4. The spec describes comparing a shared token header; current Streams documentation specifies HMAC signatures. A literal implementation rejects legitimate deliveries. **Fix:** specify HMAC verification and signed-body handling now; capture a real Arc payload early. Arc testnet Streams support is documented, but account access, dataset selection, backfill and latency still need a live check. [Webhook verification](https://www.quicknode.com/guides/quicknode-products/streams/validating-incoming-streams-webhook-messages), [supported networks](https://www.quicknode.com/docs/streams/supported-chains)

20. **Major — Hosting and finalization dependencies arrive too late.**  
    **Plan:** Schedule, 0.2, 3.4, 4.3–4.5. Lane 3 needs a reachable destination before the deployment task. Vercel Hobby rejects per-minute cron configuration; relying on the page’s one-shot fallback leaves transient failures unretried. **Fix:** deploy the webhook shell on day one, select the scheduler/hosting plan, measure provisioning against function limits, and make finalization retryable and idempotent. Establish an email → payable call → Stream → second-browser update by Nov 13. [Vercel cron limits](https://vercel.com/docs/cron-jobs/usage-and-pricing)

21. **Major — Realtime has a missed-update window.**  
    **Plan:** 3.4. “Load once, then subscribe” misses payments between those operations; reconnects can leave the progress bar stale indefinitely. **Fix:** establish the subscription before reconciling the snapshot and refetch on reconnect. Test an update during initial loading.

22. **Major — Lane ownership and scaffolding need explicit authorization. My Supabase-owner vote: conductor.**  
    **Rules:** Ground rule 2, Lanes; **Plan:** 0.1–0.2, 3.4. Lane 3 writes unowned `docs/streams.md`. Conductor scaffolding writes Lane 1 dependencies/samples and Lane 4 components, beyond the listed shared-config exception. `web/lib/supabase/` is unassigned in AGENTS.md. **Fix:** formally assign shared clients/root scaffolding to the conductor, authorize the initial bootstrap handoff, and move the Streams writeup to Lane 3’s handoff for conductor publication. Also remove generated `app/page.tsx` before adding `(screens)/page.tsx`, or both resolve to `/`. [Next.js routing rule](https://nextjs.org/docs/app/api-reference/file-conventions/route-groups)

23. **Minor — Test sequencing and operational checks miss requirements.**  
    **Spec:** Tests, Risks; **Plan:** 1.3, 1.6, 3.1. Test 13 is written after implementation despite the tests-first requirement. Test 0’s local `vm.deal` assertions assume the decimals they purport to verify. The relayer low-balance warning has no implementation task. Bare `supabase db lint` targets local infrastructure despite “no Docker.” **Fix:** write invariant properties first, add executable Arc decimals assertions, schedule the balance warning, and use an explicitly remote lint command with failure exit behavior. [CLI reference](https://supabase.com/docs/reference/cli/introduction)

24. **Minor — Submission tasks need two concrete additions.**  
    **Brief:** Core flow 2; **Plan:** 4.3–4.5. No task explicitly exposes a copyable invite link, and a full 120-second wait consumes most of the 2–3-minute video. **Fix:** add the invite-link control and script an edited, clearly indicated countdown transition before recording. All required submission artifacts otherwise have named tasks.