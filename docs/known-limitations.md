# Known limitations (hackathon build)

These are accepted on purpose for the UBC 2026 submission (spec amendments A16 and A17). Copy this section into the submission README.

1. **Stuck-organizer payout.** `finalizeRelease` sends the pot to the organizer. If the organizer's address refuses the transfer (for example, a contract that reverts when it receives USDC), the pot stays in *Payout requested* and can't be released. The app can't reach this case, because every organizer is a Circle developer-controlled EOA wallet, and an EOA always accepts transfers. A production version would add a fallback, such as letting members reclaim funds after a grace period.
2. **Seat swaps after payment.** The organizer can replace an *unpaid* member after others have paid. That changes who is allowed to object to a release. Paid members' money is never at risk, but the objection electorate can shift.
3. **Late payout request.** After the request window ends, the organizer can still request the payout until someone calls `expire`, so the two overlap. Members keep their veto: the objection window still applies, and the payout never goes to anyone but the organizer. An independent review rated this medium. The fix is a one-line check in `requestRelease` and needs a redeploy (A17).
4. **No contract-level deadline cap.** The contract accepts any future deadline, so a pot made by calling it directly could have a deadline decades away, and paid members cannot refund before it. The app and API cap deadlines at 365 days, so pots made in the app can't do this.
5. **A member or organizer that is a smart contract** and rejects native USDC could be unable to receive a refund or the payout. The app only ever uses Circle EOA wallets, which always accept transfers.
6. **Custody.** The backend holds signing authority for every member wallet (Circle developer-controlled wallets). The contract guarantees the organizer can't take the money early. It doesn't protect against the operator (A13).
7. **Rate limits are per server instance.** The "5 pots per hour" limiter is kept in memory, so on Vercel each instance counts separately. The gas top-up daily cap is enforced in Supabase and is global.
8. **Testnet only.** Everything runs on Arc testnet with testnet USDC.
