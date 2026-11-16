# Handoffs: ui lane

## Tasks 4.2, 4.3, 4.4: create form, status screen, home/sign-in/join (2026-11-13)

Branch `lane/ui`, on top of main `1488c08`. Not merged or pushed.
- `536e0b0` feat(ui): create pot form (4.2)
- `b316a3e` feat(ui): pot status screen with live progress (4.3)
- `267f218` feat(ui): home, sign-in, join (4.4)

Skipped as instructed: 4.1 (Claude Design pass) and 4.5. The screens are plain shadcn and mobile-first (single column, max-w-md).

### Done
- **4.2 `/new`:** `validateCreate(input, now)` checks the same rules as `createPotSchema` (it imports `CreatePotBody` from the API schema), using `parseUnits` math. `deriveShare(total, n)` shows the share live, read-only. The form has member rows you can add and remove (up to 20), a datetime-local deadline, a threshold, and two window fields with presets (objection 2 min / 48 h / custom; request 2 min / 7 days / custom; custom is entered in minutes). On submit it POSTs `/api/pots`, then goes to `/pots/[potId]`. A 401 goes to `/sign-in?next=/new`. Other errors show the server's `message`.
- **4.3 `/pots/[potId]`:** `availableActions(s, myAddress, now)` follows A8 at the boundaries and compares addresses case-insensitively. It doesn't rely on `is_organizer` (that can be null) and compares `organizer_address` instead. `verifiedReceipt(text, hash)` implements A12; otherwise the screen shows "Receipt pending".
  - `PotActions` covers pay, refund, request-release (receipt textarea, 1–500 chars), object, finalize, expire, and swap (folded into a `<details>`). Every button disables while a request is pending; a ref blocks double taps. Errors show the server's `message`. After pay or refund, a confirmation shows a checkmark, the amount, an explorer link, and one Done button.
  - The page uses `usePot` for live data and `/api/wallet/me` for the viewer's wallet. It shows the progress bar (USDC in the pot vs. total, N of M paid), a countdown for each state, the member list (paid / not yet / refunded / objected / left, organizer and "you" tags), and the invite link with a copy button (organizer only, while Funding).
  - A9: while `finalize` is available, the page POSTs `/finalize` immediately and then every 10 s. It stops when the state leaves PayoutRequested. The Finalize button is also visible.
- **4.4:**
  - `/` streams behind Suspense. Signed out, it shows a short landing page with Start a pot / Sign in. Signed in, it lists the user's pots from `pot_status` (RLS scopes the rows), with New pot and Sign out.
  - `/sign-in` sends a magic link with `emailRedirectTo = ${NEXT_PUBLIC_APP_URL || origin}/api/wallet/callback?next=<safe path>`.
  - `/join/[token]`:
    - Signed out: "You're invited to {title}" with the sign-in form inline, keeping `next=/join/<token>`.
    - Signed in: the token is resolved server-side with the admin client (`pot_meta` → `pot_invites` by normalized email, plus an organizer check through `users.wallet_address` vs `pots.organizer_address`). It then either redirects to `/pots/<id>` or shows "This invite isn't for your email". An unknown token shows "Invite not found".
- Cache Components: no segment config exports. `params`, `searchParams` and every cookie or session read happen inside `<Suspense>`, as the bundled docs describe (`authentication-with-cache-components.md`, `dynamic-routes.md`). The build shows `/`, `/sign-in`, `/pots/[potId]` and `/join/[inviteToken]` as Partial Prerender and `/new` as static.

### Files changed
- `web/components/pot/`: `validate.ts`, `validate.test.ts`, `CreatePotForm.tsx`, `WindowField.tsx`, `api.ts`, `Screen.tsx`, `actions.ts`, `actions.test.ts`, `PotActions.tsx`, `PotActions.test.tsx`, `PotStatus.tsx`, `ProgressBar.tsx`, `MemberList.tsx`, `Countdown.tsx`, `InviteLink.tsx`, `useMe.ts`, `auth.ts`, `auth.test.ts`, `invite.server.ts`, `SignInForm.tsx`, `SignOutButton.tsx`, `PotList.tsx`, `linkButton.ts`
- `web/app/(screens)/`: `page.tsx` (replaces the placeholder), `new/page.tsx`, `pots/[potId]/page.tsx`, `sign-in/page.tsx`, `join/[inviteToken]/page.tsx`
- `docs/handoffs/ui.md`, `docs/handoffs/ui-screenshots/*.png`

### Tests and build (exit 0)
TDD: every test file failed first (module missing or function missing), then passed.
```
$ cd web && npx vitest run && npx tsc --noEmit && npm run lint && npm run build
 Test Files  13 passed (13)
      Tests  223 passed (223)      # Lane 4: validate 14, actions 14, PotActions 5, auth 8
> eslint                           # no diagnostics
✓ Compiled successfully
✓ Generating static pages using 7 workers (12/12)
┌ ◐ /   ├ ○ /new   ├ ◐ /pots/[potId]   ├ ◐ /join/[inviteToken]   └ ◐ /sign-in
```
Note: `tsc --noEmit` needs `npx next typegen` first on a fresh checkout (the existing `LayoutProps` issue).

### Screenshots (`docs/handoffs/ui-screenshots/`, headless Chrome against `next dev`, signed out)
- `home-signed-out.png`: landing copy, Start a pot, Sign in.
- `new.png`: the full form renders, with the select presets defaulting to "2 minutes (demo)".
- `sign-in.png`: email form.
- `pot-0-signed-out-390.png`: `/pots/0` signed out. RLS hides the row, so it shows "We couldn't find this pot" with Sign in. `/api/wallet/me` → 401, as expected.
- `join-bad-token.png`: "Invite not found".
- Headless Chrome won't make a window narrower than about 500 px, so 390 px shots come out cropped on the right. I took the others at 600 px, where the max-w-md column renders correctly.
- Fixed during the check: `<Link>`s styled with `buttonVariants()` lost the outline border, because `border-transparent` wasn't merged. Links now use `linkButton()`, which runs `cn()` the same way `<Button>` does.
- **Not checked in the browser:** the signed-in status screen with real data, the pay flow, and two browsers updating live. That needs a session plus a real pot, and it's the conductor's end-to-end step (Task 4.4 Step 2).

### Blockers / for other lanes
- **Conductor (globals.css):** `--font-sans: var(--font-sans);` refers to itself, so the whole app falls back to the browser's serif font (visible in the screenshots). It probably should be `var(--font-geist-sans)`. That file is conductor-owned, so I didn't touch it. `app/layout.tsx` also still has the "Create Next App" metadata title.
- **Conductor:** set `NEXT_PUBLIC_APP_URL` on Vercel. The invite link and magic-link redirect fall back to `window.location.origin` if it's missing.
- **Lane 2:** `/api/wallet/me` returns 503 while the wallet is being provisioned, and the status page then treats the viewer as signed out (no actions). A retry or a "setting up your wallet" state could come later.
- Join redirects straight to the pot, as the plan says. The design refs' "You're in" step can go in with the 4.1 design pass.
- No new dependencies or shadcn components were needed.

## Review fixes (2026-11-13 full-codebase review)

### Done
1. **Sign-in fallback (low):** the Suspense fallback was a working `SignInForm` with `next="/"`, so a fast submit dropped the redirect. It is now `SignInFormSkeleton`, which has disabled controls and `aria-busy`.
2. **Inactive invites (low):** `lookupInvite` checks that the invite's address is an active `pot_members` row. A swapped-out member gets the distinct `left` outcome and sees "You're no longer in this pot." The organizer still gets in. Pot members are projected from events at creation, so a new invitee already has an active row before they pay.
3. **Custom window input (low):** `WindowField` latches custom mode in local state. The input stays mounted while the user types a value that equals a preset, and ends only when a preset is picked. A value that matches no preset always shows the input.
4. **Finalize jitter and guard (low):** `finalizeJitterMs(potId)` gives a deterministic 0–3000 ms offset (no `Math.random`). `finalizePot` in `finalize.ts` holds one in-flight request per pot, shared by the auto tick and the Finalize button. `useAutoFinalize` (moved to `autoFinalize.ts`) fires after the jitter, then every 10 s, and its cleanup stops the timers once finalize is no longer eligible.

### Files changed
- `web/app/(screens)/sign-in/page.tsx` (fallback uses `SignInFormSkeleton`)
- `web/app/(screens)/join/[inviteToken]/page.tsx` (handles `left`; new `NoLongerMember` card)
- `web/components/pot/auth.ts`, `auth.test.ts` (`InviteLookup.isActiveMember`, `resolveInvite` → `left`)
- `web/components/pot/invite.server.ts`, `invite.server.test.ts` (new; active-member query, fake-DB test)
- `web/components/pot/SignInFormSkeleton.tsx` (new), `signInFallback.test.tsx` (new)
- `web/components/pot/WindowField.tsx`, `WindowField.test.tsx` (new)
- `web/components/pot/finalize.ts`, `finalize.test.ts` (new), `autoFinalize.ts`, `autoFinalize.test.tsx` (new, fake timers)
- `web/components/pot/PotActions.tsx` (finalize goes through `finalizePot`), `PotStatus.tsx` (inline auto tick removed)

### Tests (TDD: every new test file failed first, for the expected reason, then passed)
```
$ cd web && npx vitest run
 Test Files  19 passed (19)
      Tests  251 passed (251)        # baseline was 14 files / 235 tests
$ npx tsc --noEmit        # exit 0
$ npm run lint            # exit 0
```
Not run here: `npm run build` (the conductor runs it).

### Blockers / notes for other lanes
- **Lane 3 / conductor:** the invite fix depends on `pot_members.active` being set to false on a swap and on `pot_invites` keeping the leaver's row. Both hold in the current projection. Keep that in mind if the swap projection changes.
- Nothing here touches `web/lib/`, `web/lib/supabase/`, `package.json`, or shared config.

### Review round 1 (conductor: invite left-state only for inactive rows)
- Blocking regression fixed: `pot_members` comes from the QuickNode projection, which lags. A freshly invited member opening the link before PotCreated is projected used to get "You're no longer in this pot". Now the lookup returns `memberState: 'active' | 'inactive' | 'unknown'`, read from the invite's `pot_members` row with no `active` filter. `resolveInvite` returns `left` only for `inactive`. `unknown` (no row yet) and `active` both resolve to `pot`, and the organizer always resolves to `pot`.
- Tests: `invite.server.test.ts` (active → pot, inactive → left, no row → pot, organizer with inactive row → pot, not-invited, unknown token) and `auth.test.ts` (same matrix at the pure-function level).
- Files: `web/components/pot/auth.ts`, `auth.test.ts`, `invite.server.ts`, `invite.server.test.ts`, `docs/handoffs/ui.md`.
- Checks: `cd web && npx vitest run` → 19 files, 254 tests passed. `npx tsc --noEmit` → exit 0. `npm run lint` → exit 0.

## Fix: distinguish signed-out, no-wallet and error in useMe (conductor /code-review high)

### Done
- `useMe` no longer turns every non-200 into "signed out". `fetchMeState` maps the `/api/wallet/me` response to a discriminated `MeState`:
  - `ready` (200 with email and wallet_address)
  - `signed-out` (401)
  - `no-wallet` (404 with `error: 'NoWallet'`; the email is echoed if present)
  - `error` (5xx, any other status or body, unreadable JSON, network failure)
- `useMe()` returns `{ me, loading, retry }`. `me` is null only while the first request is in flight. `retry` re-requests after an error.
- `PotStatus`: only `ready` gets actions (`availableActions` runs only for `ready`, and so does `useAutoFinalize`, through `actions`). The invite link is also shown only for `ready`.
  - `no-wallet`: "You're signed in but not part of this pot yet." No buttons and no sign-in prompt.
  - `error`: "We couldn't check your account…" with a "Try again" button. No sign-in button.
  - `signed-out` with the pot visible: a "Sign in to take actions on this pot" line with a sign-in link. This is a small addition beyond the brief, so the signed-out viewer still has a way in.
  - `signed-out` with no pot found: the sign-in link as before.
- Unchanged: `/api/wallet/me` (it is outside this lane's file list) and `availableActions` itself.

### Files changed
- `web/components/pot/meState.ts` (new): `MeState`, `meStateFromResponse`, `fetchMeState`
- `web/components/pot/meState.test.ts` (new): every status and body case, plus network failure and non-JSON body
- `web/components/pot/useMe.ts`: hook returns `{ me, loading, retry }`
- `web/components/pot/useMe.test.tsx` (new): loading, retry after 5xx → ready, 404 NoWallet
- `web/components/pot/PotStatus.tsx`: state-based rendering, `IdentityNotice`
- `web/components/pot/PotStatus.test.tsx` (new): one test per state, with usePot, useMe and autoFinalize mocked
- `docs/handoffs/ui.md`

### Tests (TDD: each new file failed for the expected reason first, then passed)
```
$ cd web && npx vitest run
 Test Files  22 passed (22)
      Tests  287 passed (287)     # before this fix: 19 files / 254 tests
$ npx tsc --noEmit                 # exit 0
$ npm run lint                     # exit 0
```

### Notes for the conductor
- The server still sends no `email` in the 404 body, so `no-wallet` carries no email. The client handles one if it arrives. Adding it is a route change in `web/app/api/`, which is outside this lane.
- The no-pot signed-out sign-in button is now `linkButton({ size: 'sm' })` and no longer full width. This is a small visual change.

## Task 4.1 design pass and Task B create-pot recovery (2026-11-15)

Branch `lane/ui`, from main `1eefee0`. Not merged or pushed.

### Done
- **Theme (globals.css):** the neutral greyscale is replaced with one palette. Token names are unchanged, and `success` and `warning` (with `-foreground` and `-soft`) are added.
  - Light: background `#faf8f4` (warm off-white), foreground `#17201c`, card `#ffffff`, primary `#0d5c47` (deep "money" green), accent `#e2f2ea`, muted `#f1eee8` / muted-foreground `#5a6661`, destructive `#b42318`, success `#17724a` on `#e0f3e8`, warning `#8a5300` on `#fcf0d9`, ring `#1f8a67`, input border `#8f887b`, radius 0.875rem.
  - Contrast (WCAG, computed): body text 15.7:1, muted text 5.6:1, primary button text 8.0:1, success/warning/destructive text 5.1 to 6.6:1, focus ring 4.1:1, input border 3.2:1 (UI boundary).
  - Dark: opt-in only, via `.dark` or `data-theme="dark"`. It does **not** follow the OS setting, because the app has no dark-mode testing yet.
- **Fonts (layout.tsx):** headings and big money numbers use Bricolage Grotesque (`--font-display`, via `next/font/google`). Body stays Geist. Money figures use the `.money` class (tabular-nums). Metadata title is now "Pot". The build loads both fonts.
- **Status screen (`/pots/[potId]`):** a state chip with one plain sentence about what happens next. A big "X USDC of Y USDC" header, a 16px-tall rounded bar, "N of M paid", and time left. Members list with initials avatars, email, and a Paid / Not paid / Refunded chip. Actions sit at the bottom as full-width buttons. The status labels changed: Collecting is now **Funding**, and Paid out is now **Released** (both on the status screen and in the home list).
- **Expired:** the contract has no Expired state. `expire` sets Frozen and emits a separate event. The UI shows **Expired** for a Frozen pot with no receipt hash (only `requestRelease` writes one; an all-zero hash counts as none). A frozen pot after an objection keeps the Frozen label.
- **Join (`/join/[token]`):** a signed-in invitee now sees a preview (pot name, your share, organizer email when known, "You'll join as <email>", one "Join pot" button). The old immediate redirect is gone. Joining writes nothing on-chain. The "You're in!" state is client-only and links to "Go to pot". The organizer line is omitted when the email is unknown. `potSummary` in `invite.server.ts` reads the share and organizer email with the admin client.
- **Confirmation (PotActions):** after any settled action, a receipt card shows a check, the amount (pay and refund only), "to <pot>" or "from <pot>", the date and time the page received the result, and the transaction hash shortened as the confirmation code. The code links to `https://explorer.testnet.arc.io/tx/<hash>` (the same URL as `chain.ts`). It is omitted when no hash came back. The time is the browser's clock at the moment of success. It is not on-chain time.
- **/new and home:** sections are labeled "Step n of 3". Every field, validation message and submit path is unchanged. Home has a larger landing headline. The list uses the new progress bar and card surfaces.
- **Sign-in:** same system (heading font and card title only).
- **Task B: create-pot recovery.** `CreatePotForm` handles `502 CreatePending` (with `circleTransactionId`) and `503` with both `potId` and `transactionHash`. Both go to `reconcile.ts`, which posts to `/api/pots/reconcile` with exactly one id and polls every 5 s on 202/503/network errors, for up to 120 s.
  - 201/200 → `router.push(/pots/<id>)`. 409 → form re-enabled with "The pot wasn't created. You can try again." 422/403/401 → locked, with a do-not-resubmit message. Timeout → locked, with a do-not-resubmit message and "refresh your pot list" advice.
  - No double submit: a ref blocks repeat submits while finishing, and the button is disabled. The form stays locked after an unrecoverable outcome.
  - `api.ts`: `postJson` failures now include `body`, so the other fields (`circleTransactionId`, `potId`, `transactionHash`) are readable. Existing callers are unaffected.
  - Until Lane 2 ships `/api/pots/reconcile`, a 404 is treated as retryable, so recovery will poll for 2 minutes and then show the timeout message.

### Files changed
- `web/app/globals.css`, `web/app/layout.tsx`
- `web/app/(screens)/page.tsx`, `sign-in/page.tsx`, `join/[inviteToken]/page.tsx`
- `web/components/pot/`: `api.ts` (+ `api.test.ts` new), `reconcile.ts` (new) + `reconcile.test.ts` (new), `CreatePotForm.tsx` + `CreatePotForm.test.tsx` (new), `PotStatus.tsx`, `ProgressBar.tsx`, `MemberList.tsx` (+ `MemberList.test.tsx` new), `potState.ts` (new) + `potState.test.ts` (new), `PotActions.tsx` + `PotActions.test.tsx` (3 confirmation tests added), `JoinPreview.tsx` (new) + `JoinPreview.test.tsx` (new), `invite.server.ts` (`potSummary`), `PotList.tsx`, `Screen.tsx`
- `docs/handoffs/ui-screenshots/*.png` (overwritten, see below)

### Tests (TDD: each new test failed first for the expected reason, then passed)
```
$ cd web && npx vitest run
 Test Files  28 passed (28)
      Tests  331 passed (331)      # baseline 22 files / 302 tests
$ npx tsc --noEmit                 # exit 0
$ npm run lint                     # exit 0
$ npm run build                    # exit 0 (Compiled successfully; 12/12 static pages)
```
Raw output is in `/private/tmp/claude-501/-Users-marcogarity/8c8abe4d-5c15-4fec-8eb4-f26778972824/scratchpad/gate-*.txt`. Also covered: the CreatePending → poll → redirect path, the 503 path, 409, 422, the 2-minute timeout, no double submit, and the reconcile loop's cancel-on-unmount.

### Screenshots
- Overwrote `home-signed-out.png`, `new.png`, `sign-in.png`, `pot-0-signed-out-390.png`, `join-bad-token.png`. These are signed-out views.
- **Not 375px.** Headless Chrome here (both `--headless=new` and `old`) lays out at about 500px whatever `--window-size` says. A 375px crop shows a cut-off 500px layout, so I didn't use one. The files are 500px-wide renders of the real layout. Playwright isn't installed, and I did not install it.

### Not done / blockers
- **Status, join preview, "You're in", and the receipt card were not checked with real data.** That needs a session plus a real pot, which is the conductor's end-to-end step. The screenshots only cover signed-out screens.
- **Real 375px phone-width check** still needs a browser that honors small windows (Playwright or a device emulator). The layout is `max-w-md` with `px-4` and `w-full`, so it should degrade to 375px, but I have not seen that.
- **Lane 2:** `/api/pots/reconcile` does not exist in this worktree yet. The client codes against the contract. Until it lands, recovery times out.
- **Lane 2 (for the conductor):** the expired-vs-frozen split uses `receipt_hash`. If the projection writes a receipt for an expired pot, the label will be wrong.
- **Dark mode:** opt-in only. Needs a visual pass before it is used.
- `Countdown.tsx` still exports the old `Countdown` component, which nothing imports now. Left in place to keep the change small.

## Deadline cap, client side (2026-11-16)

Branch `lane/ui`. Not merged or pushed. Matches the server cap that Lane 2 is adding. The contract is unchanged.

### Done
- `validate.ts`: exports `DEADLINE_MAX = 365 * 24 * 3600` (seconds). The deadline must be at most that far after now, compared in whole seconds. Past deadlines still say "Deadline must be in the future". Empty or unparsable still says "Pick a deadline". Over the limit says "Deadline must be within one year".
- `CreatePotForm.tsx`: the datetime-local input gets `max` = now + 365 days, in the same local `YYYY-MM-DDTHH:mm` format as its value. It is read with `useSyncExternalStore` (server snapshot `undefined`), so SSR and hydration HTML match. An effect with setState fails the lint rule `react-hooks/set-state-in-effect`.
- Tests (written first and seen failing): validator tests for empty, past, exactly 365 days (passes), one second beyond (fails with the new message), decades away, and the exported constant. Form tests: a 2030 deadline is blocked with no API call, and the `max` attribute equals now + 365 days. `fillForm` now uses a date 30 days out, because the old 2030 date would be rejected.

### Files changed
- `web/components/pot/validate.ts`, `validate.test.ts`
- `web/components/pot/CreatePotForm.tsx`, `CreatePotForm.test.tsx`
- `docs/handoffs/ui.md`

### Gates (fresh run)
```
 Test Files  30 passed (30)
      Tests  359 passed (359)
$ npx tsc --noEmit                 # exit 0
$ npm run lint                     # exit 0
$ npm run build                    # exit 0 (static, partial prerender and dynamic routes listed)
```
Raw output: `/private/tmp/claude-501/-Users-marcogarity/8c8abe4d-5c15-4fec-8eb4-f26778972824/scratchpad/ui-gate-vitest.txt`, `ui-gate-tsc.txt`, `ui-gate-lint.txt`, `ui-gate-build.txt` in that directory.

### Notes for the conductor
- The max is computed when the form mounts. A page left open past midnight keeps the old max. The validator still runs on the live clock at submit, so this only affects the picker hint.
- Users can still type a date past the max. The validator catches it, so the message is the real rule.

## Email code sign-in, with link fallback (2026-11-16)

Branch `lane/ui`. Not merged or pushed.

### Done
- `SignInForm` is two-step. Step 1 is unchanged: `signInWithOtp` with `emailRedirectTo: magicLinkRedirect(...)`. Step 2 shows the email and a numeric code field (`inputMode="numeric"`, `autoComplete="one-time-code"`). Non-digits are stripped and the code is capped at 10 digits. Verify with fewer than 6 digits shows a message and does not call `verifyOtp`. Verify calls `verifyOtp({ email, token, type: 'email' })` and then `router.replace(safeNext(next))` and `router.refresh()`. A wrong code shows the agreed message and keeps the field.
- "Send a new code" has a 30-second cooldown (a 1-second interval) and calls `signInWithOtp` again. It clears the field and shows "New code sent". "Use a different email" returns to step 1. All buttons are disabled while a request is in flight. The code and email are never logged.
- `LinkNotice` (new, `components/pot/LinkNotice.tsx`) shows the calm notice for `?error=link`. The sign-in page and the join page (not-signed-in branch, above the form) both render it. Styling matches `PotStatus` (`rounded-xl bg-muted p-3`); there is no Alert component in `ui/`.
- `SignInFormSkeleton` and its fallback test are unchanged.

### Files changed
- `web/components/pot/SignInForm.tsx`
- `web/components/pot/SignInForm.test.tsx` (new, 12 tests)
- `web/components/pot/LinkNotice.tsx` (new)
- `web/app/(screens)/sign-in/page.tsx`
- `web/app/(screens)/join/[inviteToken]/page.tsx`

### Gates (fresh run)
```
  Test Files  32 passed (32)
       Tests  414 passed (414)
$ npx tsc --noEmit          # exit 0
$ npm run lint              # exit 0
$ npm run build             # exit 0
```
Raw output: `/private/tmp/claude-501/-Users-marcogarity/8c8abe4d-5c15-4fec-8eb4-f26778972824/scratchpad/ui4-vitest.txt`, `ui4-tsc.txt`, `ui4-lint.txt`, `ui4-build.txt`.

### Needs another lane (Lane 2, wallet)
- `web/app/api/wallet/callback/route.ts` does not yet redirect with `error=link`. On a failed or expired link it returns JSON 401/400. It should redirect to `/sign-in?error=link&next=<safe next>` (or `/join/<token>?error=link` for the join flow). The notice only renders once that lands. The UI reads the param and does nothing else.
- Supabase's "Magic Link" email template should include `{{ .Token }}` so the 6-digit code appears in the email. The code length is set in the Supabase project; the field accepts 6 to 10 digits.

### Notes
- The old test "Check your email … Open it on this device" is replaced by "We emailed you a 6-digit code" with "or click the link in the email, in this same browser".
- Testing note: the sign-in page's Suspense child only mounts inside `act`. Tests that render it wrap the render in `await act(...)`.

## 2026-11-16: Wallet claim on the code sign-in path (Lane 4)

### Done
- `SignInForm.onVerify` now calls `postJson('/api/wallet/claim', {})` after `verifyOtp` succeeds and before `router.replace`/`router.refresh`. Success continues exactly as before.
- On failure it shows the response's `message` when it is a string (409 IdentityConflict, 503), otherwise "We could not finish signing you in. Please try again." It stays on the code step, re-enables Verify, and does not navigate. Network errors and thrown errors show the generic message.
- A failed `verifyOtp` does not call the claim endpoint. Nothing logs the code or the email.

### Files changed
- `web/components/pot/SignInForm.tsx`
- `web/components/pot/SignInForm.test.tsx` (mocks `./api` `postJson`; 6 new claim tests, including the call-order assertion)

### Gates (fresh run)
```
$ npx vitest run     # exit 0
  Tests  421 passed (421)
$ npx tsc --noEmit   # exit 0
$ npm run lint       # exit 0
$ npm run build      # exit 0
```
Raw output: `/private/tmp/claude-501/-Users-marcogarity/8c8abe4d-5c15-4fec-8eb4-f26778972824/scratchpad/ui4-vitest.txt`, `/private/tmp/claude-501/-Users-marcogarity/8c8abe4d-5c15-4fec-8eb4-f26778972824/scratchpad/ui4-tsc.txt`, `/private/tmp/claude-501/-Users-marcogarity/8c8abe4d-5c15-4fec-8eb4-f26778972824/scratchpad/ui4-lint.txt`, `/private/tmp/claude-501/-Users-marcogarity/8c8abe4d-5c15-4fec-8eb4-f26778972824/scratchpad/ui4-build.txt`.

### Needs another lane (Lane 2, wallet)
- `POST /api/wallet/claim` must exist and answer as the contract says: 200 `{ok:true}`; 401 `{error:'Unauthorized'}`; 409 `{error:'IdentityConflict', message}`; 503 `{message}`. Until it exists the code path will show the generic failure message.
