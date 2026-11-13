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
