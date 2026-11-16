# Contract security review (Cursor, Ask mode)

Reviewed: `contracts/src/Pot.sol` and `contracts/src/IPot.sol`, as deployed at `0xf842F699128A2e575d20BcC92F0472C7ad59e5C8` on Arc testnet.
Run by Marco in Cursor on 2026-11-16 and pasted here unchanged. The first two attempts with the `/review-security` command failed because its helper model is not on Cursor's Free plan, so this review used a plain Ask-mode prompt instead. Cursor never edits code (AGENTS.md); the triage at the bottom is the conductor's.

## Cursor's findings (verbatim)

1. High — finalizeRelease (lines 181–191) and _send (lines 252–255)
A pot whose organizer cannot receive native USDC becomes permanently stuck in PayoutRequested once the objection window ends. Every member's share is locked in the contract.

finalizeRelease sets Released and then pushes total with a raw call. If that call returns false, the whole transaction reverts, so the state stays PayoutRequested. After block.timestamp >= releaseEligibleAt:

object reverts with WindowClosed
expire reverts with WrongState (it only runs from Locked)
refund reverts with WrongState (it only runs from Funding or Frozen)
Scenario:

A contract with no payable receive/fallback calls createPot for four members at 300 USDC each (total = 1200e18), threshold = 4, objectionWindow = 60.
All four pay. The pot is Locked. The organizer calls requestRelease.
One member is offline for 60 seconds, so objections stay below the threshold.
Anyone calls finalizeRelease. _send gets false and reverts with TransferFailed.
Retrying forever does the same. The 1200 USDC stays in the contract. While the window is still open, members can object to reach the threshold, freeze, and refund. After it closes, that path is gone.
This is pinned by test_RejectingOrganizer_FinalizeReverts_KnownGap. An EOA organizer can receive native USDC, so the app's Circle EOAs do not hit it. Any contract organizer does.

Fix: keep a withdrawable balance and let the organizer pull, so a failed transfer does not brick the state. Or let anyone move PayoutRequested to Frozen after releaseEligibleAt plus a grace period, so members can refund when the push keeps failing.

2. Medium — requestRelease (lines 151–160) versus expire (lines 194–201)
expire treats lockedAt + requestWindow as the deadline. requestRelease never reads that deadline. From Locked, the organizer can open a payout at any later time, and can take the same block (or an earlier one) ahead of expire.

Scenario:

Everyone pays. lockedAt = T, requestWindow = 7 days, objectionWindow = 60.
The organizer does nothing. Members wait until T + 7 days and submit expire, expecting Frozen and refunds.
The organizer's requestRelease is ordered first. State becomes PayoutRequested. expire reverts with WrongState.
Members have 60 seconds to reach threshold. Anyone can then finalizeRelease, and the organizer receives total.
The same sequence works with no mempool race: if nobody has called expire yet, the organizer just calls requestRelease months later.

Fix: in requestRelease, revert when block.timestamp >= p.lockedAt + p.requestWindow (a RequestWindowClosed error). expire then becomes the only transition once the window has passed.

3. Medium — createPot (line 58), refund (line 141), swapSeat (lines 102–107)
deadline has no upper bound. The only check is deadline <= block.timestamp. A paid member cannot leave. refund in Funding reverts with DeadlineNotPassed until that timestamp, and swapSeat is organizer-only.

Scenario:

The organizer creates a pot with deadline = type(uint256).max, four seats, and a share of 300e18.
Three members pay. The organizer's seat never pays, and the organizer never calls swapSeat.
pay can no longer lock the pot, because one seat is empty. refund reverts for the rest of time.
900 USDC stays in the contract. The same trap exists when any member refuses to pay and the organizer refuses to swap them, if the deadline is far enough out to be permanent in practice.
Fix: cap deadline in createPot (for example block.timestamp + 365 days) and revert InvalidParams above the cap. A paid member's own exit from Funding would also remove the organizer as a single point of failure.

4. Low — refund (lines 136–148) and swapSeat (lines 126–133)
A paid member whose address rejects native USDC can never retrieve that share, and the organizer cannot remove them.

Scenario:

A contract member pays exactly share, then its receive is made to revert.
After the deadline, or after Frozen, refund reverts with TransferFailed. hasRefunded is rolled back with the transaction.
Before the deadline, swapSeat does the same, so the organizer cannot put someone else in that seat.
That one share stays in the contract. Other members still refund, because each refund is its own call. Other pots are unaffected, because finalizeRelease sends p.total, not address(this).balance.
Fix: the same pull-balance as finding 1. Credit share to the leaver and clear the seat without pushing. They withdraw later, from an address that can receive.

Checked and found safe
Accounting and rounding. createPot requires share > 0, share <= type(uint256).max / n, and total == share * n. There is no division. pay accepts only msg.value == share. paymentsCount goes up by one on pay and down by one only when a paid seat is swapped out, and that swap pushes exactly share. Locked is set only when paymentsCount == members.length, which is the same moment the pot's net deposits equal total. refund cannot run in the same timestamp as pay: pay and swapSeat require timestamp < deadline, and a Funding refund requires timestamp >= deadline. So a refund cannot drain a pot that then locks. finalizeRelease pays total once. Frozen and post-deadline refunds pay share once per current member (hasPaid stays true, hasRefunded blocks a second pull, and wasMember blocks a swapped-out address from paying again). Pots share one balance, and each payout is that pot's own accounted amount, so a stuck share cannot be taken by another pot.

Reentrancy. Every mutating function uses nonReentrant. swapSeat, refund, and finalizeRelease write state before _send. A receiver that reenters hits ReentrancyGuardReentrantCall. A receiver that reverts rolls the outer transfer back. Tests cover both the propagating and the swallowed case.

State machine. The only edges are Funding → Locked (full pay), Locked → PayoutRequested (requestRelease), Locked → Frozen (expire), PayoutRequested → Frozen (objections >= threshold), and PayoutRequested → Released (finalizeRelease). Released and Frozen have no outgoing edge. An unknown potId is an empty Funding pot with deadline == 0, so pay hits DeadlinePassed and the organizer-only calls hit NotOrganizer. expire really does set Frozen. It emits Expired only. Indexers have to treat Expired as state 4, or the UI will hide refunds that refund already allows.

Access control. swapSeat and requestRelease are msg.sender == organizer. pay and object require isMember. finalizeRelease and expire are permissionless and pay the organizer, or freeze, rather than paying the caller. The organizer cannot be rewritten. There is no early withdraw from Funding or Locked.

Seat swaps. Only in Funding, before the deadline. The leaver is cleared, the replacement is written into the same slot, and a paid leaver is marked hasRefunded before the push. address(0), duplicates, and former members revert. A swap and that member's pay can be ordered either way; the member keeps their funds or gets them back. The organizer can churn seats until the deadline. That is the commitment-pot trust model, and finding 3 is what makes the wait unbounded.

Objection timing. object requires timestamp < releaseEligibleAt. finalizeRelease requires timestamp >= releaseEligibleAt. The same second cannot do both. Objections at or above threshold set Frozen in that transaction, so finalizeRelease cannot pass. Silence still approves the payout: a minority below threshold cannot stop it, and receiptHash is not checked on-chain. Both are the designed veto, including a 60-second minimum window.

Transfers that revert for everyone else. One member's failed refund does not freeze the pot or any other pot. MAX_MEMBERS is 20, so the create and swap loops are bounded. Non-payable functions reject accidental value. There is no receive, so a plain transfer to the contract reverts.

The file search finished. Pot.sol and IPot.sol are not in this checkout (lane0/scaffold). The source copies live under ~/code/pot-contract and match the copies in pot, pot-wallet, pot-ui, and pot-events-data. The security review used that source.

---

## Conductor triage (2026-11-16)

Labels: **critical** = money can be lost, stuck or stolen through a path the app can reach; **fix**; **ignore**. Nothing here is critical in that sense, because every address the app creates for an organizer or member is a Circle EOA wallet.

| # | Cursor severity | Label | One-line reason |
|---|---|---|---|
| 1 | High | **ignore** (accepted, A16) | Known gap, already pinned by a test and documented. Only a contract organizer can reach it; the app's organizers are always EOAs. Needs a pull-payment redesign, which is not worth a redeploy now. |
| 2 | Medium | **fix** | Real gap against spec A4/A8: the request window should end where `expire` begins, but `requestRelease` ignores it, so the two overlap. The existing test `test_21_RequestAfterRequestWindow_UntilExpire` pins the loophole rather than the spec. Two-line contract change. |
| 3 | Medium | **fix, in two layers** | (a) App layer, no redeploy: the API and the form only check "deadline is in the future", so a user can set a deadline decades out. Cap it at 365 days. (b) Contract layer, needs a redeploy: cap `deadline` in `createPot`. |
| 4 | Low | **ignore** (accepted) | Same root cause as 1. A member whose address rejects USDC would have to be a contract; app members are always EOAs. Add to the known-limitations list. |

Also confirmed by Cursor, and consistent with ours: the indexer already treats `Expired` as state 4 (`fold.ts`), and the "checked and found safe" list (accounting, reentrancy, state machine, access control, objection timing) matches the findings of the earlier Opus and Codex reviews.

### Actions

- **No redeploy needed:** app-level 365-day deadline cap (Lane 2 API schema, Lane 4 form validation).
- **Needs Marco's decision:** contract fixes for 2 and 3(b) change `Pot.sol`, so they only take effect on a new deployment. Prepared on `lane/contract` with tests and held; nothing deploys until Marco replies exactly "walkthrough done, deploy".
