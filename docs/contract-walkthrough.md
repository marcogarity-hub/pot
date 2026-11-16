# Pot.sol walkthrough

Contract: `contracts/src/Pot.sol`, deployed and verified on Arc testnet at `0xf842F699128A2e575d20BcC92F0472C7ad59e5C8` (2026-11-13, block 72173814).
"Brief tests" are the numbered list in `docs/brief.md`, items 1–21. Foundry names them `test_NN_*`, and test 13 is `invariant_13_*`. Tests 0, 22 and 23 and the unnumbered `test_*` cases come from the approved spec, not the brief.

States: Funding (0) → Locked (1) → PayoutRequested (2) → Released (3) or Frozen (4). Frozen happens two ways: members object (`object`), or the organizer never asks for the payout (`expire`).

## Write functions

| Function | What it does | Who may call it | Brief tests covering it | Other tests |
|---|---|---|---|---|
| `createPot` | Opens a pot with a total, an equal share, 1–20 unique non-zero members, a future deadline, an objection threshold (1..n) and two windows. The caller becomes the organizer. | Anyone. The caller is recorded as organizer. | **None** ⚠️ | `test_PotCreated_Emitted`, 16 `test_create_*` cases (bad totals, overflow, 0/21 members, threshold 0 and above n, deadline now, window bounds, zero and duplicate members), `test_00_Decimals` |
| `pay` | Takes exactly one share of native USDC from a member before the deadline. The last payment locks the pot and records `lockedAt`. | Members who haven't paid yet, while Funding and before the deadline | 1, 3, 8, 9, 10, 12, 20, 13 (invariant) | `test_pay_AtDeadline_Reverts`, `test_pay_JustBefore_Ok` |
| `swapSeat` | Replaces a member with a new address that was never a member. If the leaver had paid, their share is refunded in the same call. | Organizer only, while Funding and before the deadline | 7 | `test_07_SeatSwap_UnpaidLeaver`, `test_07_FormerMemberCantRejoin`, six `test_07b_*` reverts, `test_SwappedOutPayer_CantRefund`, `test_RejectingMember_SwapSeatReverts` |
| `refund` | Returns one share to a paying member. Allowed in Funding after the deadline (the pot didn't fill), or any time in Frozen. | Current members who paid and haven't been refunded | 4, 5, 6, 19 | `test_refund_NonPayer`, `test_refund_Locked`, `test_19_ObjectorCanRefundInFrozen`, `test_RejectingMember_RefundReverts`, two reentrancy tests |
| `requestRelease` | Records the receipt hash and starts the objection window. The pot moves to PayoutRequested. | Organizer only, while Locked. This still works after the request window has passed, until someone calls `expire`. | 21, 11 | `test_21_RequestTwice_WrongState`, `test_21_RequestAfterRequestWindow_UntilExpire`, `test_21_RequestAfterExpire_WrongState` |
| `object` | Records one objection per member during the window. Reaching the threshold freezes the pot. | Current members who haven't objected, while PayoutRequested and before `releaseEligibleAt` | 15, 17, 18 | `test_object_BelowThreshold_EmitsObjectedOnly`, `test_object_AtWindowEnd_Reverts`, `test_object_LastSecond_Works`, `test_object_WrongState`, `test_object_AfterFrozen_WrongState` |
| `finalizeRelease` | After the objection window, sends the full total to the organizer and marks the pot Released. | **Anyone.** The app's treasury calls it (auto-finalize). | 2, 14, 16, 11 | `test_finalize_Twice_WrongState`, `test_finalize_BelowThreshold`, `test_RejectingOrganizer_FinalizeReverts_KnownGap` (A16 known limitation) |
| `expire` | If the organizer hasn't requested payout within `requestWindow` of locking, freezes the pot so every payer can refund. | **Anyone**, while Locked and after `lockedAt + requestWindow` | **None** ⚠️ (the brief has no expire test) | `test_22_Expire_AfterRequestWindow`, four `test_23_Expire_*` reverts |

## Read functions

| Function | What it does | Who may call it | Brief tests covering it | Other tests |
|---|---|---|---|---|
| `getPot` | Returns the whole pot (settings, state, counters, receipt hash, members). | Anyone | **None directly** ⚠️, used to assert results in other tests | Used across every test file and the invariant handler |
| `nextPotId` | The id the next pot will get. | Anyone | **None** ⚠️ | Asserted in `PotFunding.t.sol` |
| `hasPaid` | Whether an address paid into a pot. | Anyone | **None directly** ⚠️, used to assert results in other tests | Funding, RefundSwap, Release, Receivers tests and the handler |
| `hasObjected` | Whether an address objected. | Anyone | **None directly** ⚠️, used to assert results in other tests | `PotRelease.t.sol` |
| `hasRefunded` | Whether an address was refunded, including through a seat swap. | Anyone | **None directly** ⚠️, used to assert results in other tests | RefundSwap, Release, Receivers tests |
| `isMember` | Whether an address currently holds a seat. | Anyone | **None directly** ⚠️, used to assert results in other tests | Funding, RefundSwap, Receivers tests and the handler |
| `wasMember` | Whether an address ever held a seat. It blocks swapped-out members from coming back. | Anyone | **None** ⚠️ | `test_07_SeatSwap*`, `test_07_FormerMemberCantRejoin` |

`_send` (internal) sends native USDC with `call` and reverts with `TransferFailed` if the receiver refuses. It's covered by the `PotReceivers.t.sol` rejecting-receiver and reentrancy tests and by invariants `invariant_Solvency` and `invariant_ReleasedPaysExactlyTotal`.

## Flags

1. **`createPot` has no numbered brief test.** It is well covered by 17 spec-level tests (16 `test_create_*` plus `test_PotCreated_Emitted`), but none of them is in the brief's list.
2. **`expire` has no brief test.** The brief predates it. Spec tests 22 and 23 cover it.
3. **Read functions have no brief tests of their own.** All of them are called and asserted inside other tests, so they are exercised, just not tested by name.
4. **Known gap (A16):** `finalizeRelease` to an organizer that refuses transfers leaves the pot stuck in PayoutRequested (`test_RejectingOrganizer_FinalizeReverts_KnownGap`). The app can't reach it, because organizers are Circle EOA wallets.
5. **Access note:** `finalizeRelease` and `expire` can be called by anyone, which is by design: they only move money according to rules already fixed, so the treasury or any member can trigger them.

Cursor security findings (Step 2b) will be labelled in `docs/handoffs/contract-cursor-review.md` once that file exists.
