# Demo runbook

Live app: https://pot-pink.vercel.app. Demo size: 3 members paying 2 USDC each (total 6 USDC), with the 2-minute demo windows.

## 30 minutes before

1. **Open the app** and sign in once with the organizer email (enter the email, then type the code from the email). If no code arrives, wait 30 seconds and use "Send a new code".
2. **Check the Stream is running:** `node scripts/quicknode-stream.mjs status` must show `status=active`. If it shows `terminated`, run `node scripts/quicknode-stream.mjs activate`.
3. **Check the treasury can cover the demo:** `node scripts/fund-demo.mjs --email a@example.com --email b@example.com --email c@example.com --amount 2` is a dry run. The treasury balance must be at least 6.5 USDC (6 for the shares plus 0.5 kept for gas). If it is short, top the treasury up from the Arc faucet first.
4. **Clean slate (optional):** `node scripts/cleanup-test-data.mjs --pots 0,1,2,3` is a dry run that lists what it would remove. Add `--yes` to remove it. It only touches the `@pot-e2e.test` accounts and the pots you list.
5. **Line up the three members** with email inboxes you can read on camera.

## The demo, step by step

1. **Organizer creates the pot.** Open New pot. Name, total 6, three member emails, a deadline later today, threshold 1, and the 2-minute presets for both windows. This creates a wallet for each member and tops up gas for them.
2. **Fund the members' shares** (testnet money): the same command as step 3 above with `--yes` added.
3. **Each member opens the invite link, signs in with the emailed code, joins, and presses Pay.** Point at the progress bar: it moves by itself as each payment's event travels through the QuickNode Stream into the database.
4. **After the third payment the pot locks.** The organizer enters a receipt text and requests the payout.
5. **The objection window opens (2 minutes).** The countdown runs. Members can object. For a second take, an objection at the threshold freezes the pot and everyone refunds.
6. **When the window ends** an open pot page finalizes it automatically within a few seconds (or press Finalize), and the money goes to the organizer. Keep at least one pot page open. Open the transaction on the Arc explorer from the receipt card.

## If something goes wrong

| Problem | Fix |
|---|---|
| No sign-in code arrives | Wait for the 30 second cooldown and request a new code. Check spam. |
| Progress bar does not move | Run `node scripts/quicknode-stream.mjs status`. If `terminated`, run `activate`. To fill in missed events: `QUICKNODE_STREAM_TOKEN=... node scripts/replay-stream.mjs --url https://pot-pink.vercel.app/api/streams` (safe to repeat). |
| A member's Pay fails with no gas | `node scripts/fund-demo.mjs --email <member> --amount 1 --yes --run-id gas2` |
| "Still being created" after creating a pot | Wait. The page checks again by itself for up to two minutes. Do not create it twice. |
| A pot looks stuck in one state | Reload. The page refreshes from the database; the contract is the source of truth. |

## Talking points

- **Arc:** USDC is the gas token and the payment token, so a member never holds anything else. Members need no wallet, no seed phrase and no gas prompt.
- **QuickNode Streams:** a filter keeps only our contract's logs, a webhook delivers them, and the database is just a cache that can be rebuilt from the chain (`scripts/replay-stream.mjs`).
- **The contract guarantees:** the organizer cannot take the money early, members get a veto window, and if the pot does not fill everyone who paid can refund.
- **Honest limits:** see `docs/known-limitations.md`. The contract had three independent reviews.
