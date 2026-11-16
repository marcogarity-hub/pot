# Sign in with Google (and Apple)

The sign-in screen can show "Continue with Google" and "Continue with Apple" above the email form. The buttons
are off until a provider is enabled in Supabase **and** listed in the `NEXT_PUBLIC_AUTH_PROVIDERS` setting, so
turning one on is safe to do at any time. Both providers go through the same `/api/wallet/callback` route as the
emailed link, so the wallet claim and the "verified session" checks (`web/lib/supabase/verified-user.ts`) apply
unchanged.

The client IDs and secrets below go **only** into the Google, Apple and Supabase dashboards. Never paste them
into chat, the repo or a `NEXT_PUBLIC_` variable.

## Google (about 10 minutes, free)

1. In Supabase: Authentication, Providers, Google. Copy the **Callback URL** shown there
   (`https://<project-ref>.supabase.co/auth/v1/callback`). Leave the page open.
2. In the Google Cloud console, create a project (or use one). Go to APIs & Services, OAuth consent screen:
   - User type **External**, app name "Pot", your email as support and developer contact.
   - Scopes: only the defaults (`openid`, `email`, `profile`). No verification is needed for these.
   - **Click "Publish app" (move it out of Testing).** In Testing only the test users you list can sign in, so judges would be refused.
3. Credentials, Create credentials, OAuth client ID, type **Web application**. Under Authorized redirect URIs add the Supabase Callback URL from step 1. Copy the client ID and client secret.
4. Back in Supabase, paste both into Providers, Google, switch **Enable** on, and save.
5. Set `NEXT_PUBLIC_AUTH_PROVIDERS=google` on Vercel (not a secret) and redeploy. The conductor can do this step once you confirm steps 1 to 4.

Test: open an invite link in a private window, press Continue with Google, pick the Google account whose
address was invited, and check that you land on the pot. Then open the same link signed in with a Google account
that was not invited and check that the page says that address is not on the invite list.

## Apple (only if you already have a paid Apple Developer account)

Apple needs the Apple Developer Program ($99 a year), a Services ID, a signing key and a client secret that
Supabase asks for as a signed token which **expires every 6 months**. Supabase's guide: Authentication, Providers,
Apple. Two more reasons to skip it for the hackathon:

- With "Hide My Email" Apple returns a private relay address (`...@privaterelay.appleid.com`) that will not match the invited address, so the person would see no pot. The sign-in screen warns about this when Apple is on.
- It cannot be tested without an Apple device or account.

If you do enable it, set `NEXT_PUBLIC_AUTH_PROVIDERS=google,apple`.

## How accounts line up

- A pot is tied to the **email address** the organizer typed, so the Google (or Apple) account must have that address as its primary email.
- By default Supabase links a Google sign-in to an existing account with the same confirmed email, so someone who first used an emailed code and later uses Google should keep the same wallet and pots. Confirm this once in the test above: sign in by code, sign out, sign in with Google, and check the same pot and wallet address appear.
- Only emails the provider has confirmed count. A session without a confirmed email, or one that ever used a password, is refused by every API route.
