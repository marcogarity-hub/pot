'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MailCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { magicLinkRedirect, parseOAuthProviders, safeNext, type OAuthProvider } from './auth';
import { OAuthButtons } from './OAuthButtons';
import { postJson } from './api';

const RESEND_COOLDOWN_SECONDS = 30;
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;
const WRONG_CODE = 'That code is wrong or has expired. Check the newest email, or send a new code.';
const CLAIM_FAILED = 'We could not finish signing you in. Please try again.';
const OAUTH_FAILED = 'We could not start that sign-in. Please try again, or use the email code below.';

/**
 * Email sign-in. Step 1 sends a code and a link; step 2 takes the code typed in.
 * The link still works as a fallback, and `next` is kept through the callback (e.g. /join/<token>).
 * When NEXT_PUBLIC_AUTH_PROVIDERS lists google and/or apple, those buttons appear above the email form and
 * go through the same callback route, so the wallet claim and the verified-session checks are shared.
 */
export function SignInForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // True while the browser is leaving for Google or Apple, so the email button does not claim it is sending.
  const [redirecting, setRedirecting] = useState(false);
  // True once verifyOtp has succeeded and only the wallet claim is left. Retries then re-run the claim alone:
  // the code is single-use, so verifying it again would wrongly report it as wrong.
  const [verified, setVerified] = useState(false);

  const providers = parseOAuthProviders(process.env.NEXT_PUBLIC_AUTH_PROVIDERS);

  // Coming back from the provider's page with the Back button restores this page from memory with the
  // buttons still disabled; re-enable them.
  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) { setBusy(false); setRedirecting(false); } };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const coolingDown = cooldown > 0;
  useEffect(() => {
    if (!coolingDown) return;
    const timer = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [coolingDown]);

  /** Sends (or re-sends) the code and link. Shared by the first request and "Send a new code". */
  async function requestCode(address: string): Promise<boolean> {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error: err } = await createBrowserSupabase().auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: magicLinkRedirect(appUrl, next) },
    });
    if (err) {
      setError(err.message);
      return false;
    }
    setCooldown(RESEND_COOLDOWN_SECONDS);
    return true;
  }

  /**
   * Starts Google or Apple sign-in. On success the browser leaves for the provider, so the buttons stay disabled;
   * the provider sends the person back to the same callback route as the emailed link. Google is asked to show
   * its account chooser, because the account must match the address the organizer invited.
   */
  async function onOAuth(provider: OAuthProvider) {
    if (busy) return;
    setBusy(true);
    setRedirecting(true);
    setError(null);
    setNotice(null);
    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const { error: err } = await createBrowserSupabase().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: magicLinkRedirect(appUrl, next),
          ...(provider === 'google' ? { queryParams: { prompt: 'select_account' } } : {}),
        },
      });
      if (err) {
        setBusy(false);
        setRedirecting(false);
        setError(OAUTH_FAILED);
      }
    } catch {
      setBusy(false);
      setRedirecting(false);
      setError(OAUTH_FAILED);
    }
  }

  async function onSubmitEmail(e: FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized || busy) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const ok = await requestCode(normalized);
    setBusy(false);
    if (ok) setSentTo(normalized);
  }

  async function onResend() {
    if (!sentTo || busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const ok = await requestCode(sentTo);
    setBusy(false);
    if (ok) {
      setCode('');
      setNotice('New code sent');
    }
  }

  async function onVerify(e: FormEvent) {
    e.preventDefault();
    if (!sentTo || busy) return;
    if (verified) {
      await completeSignIn();
      return;
    }
    if (code.length < MIN_CODE_LENGTH) {
      setError('Enter the code from the email.');
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    const { error: err } = await createBrowserSupabase().auth.verifyOtp({ email: sentTo, token: code, type: 'email' });
    if (err) {
      setBusy(false);
      setError(WRONG_CODE);
      return;
    }
    setVerified(true);
    await completeSignIn();
  }

  /**
   * Ties the signed-in account to the member's wallet row, then navigates. The emailed link does the same
   * claim, so the code path must too. Runs after verifyOtp succeeds; a failure leaves the session in place
   * and only this step is retried.
   */
  async function completeSignIn() {
    setBusy(true);
    setError(null);
    setNotice(null);
    const claimed = await claimWallet();
    if (!claimed.ok) {
      setBusy(false);
      setError(claimed.message);
      return;
    }
    setVerified(false);
    router.replace(safeNext(next));
    router.refresh();
  }

  /** Ties the signed-in account to the member's wallet row. Any failure, including a network error, is reported. */
  async function claimWallet(): Promise<{ ok: true } | { ok: false; message: string }> {
    try {
      const res = await postJson('/api/wallet/claim', {});
      if (res.ok) return { ok: true };
      const message = typeof res.body.message === 'string' ? res.body.message : CLAIM_FAILED;
      return { ok: false, message };
    } catch {
      return { ok: false, message: CLAIM_FAILED };
    }
  }

  function useDifferentEmail() {
    setSentTo(null);
    setCode('');
    setCooldown(0);
    setNotice(null);
    setError(null);
    setBusy(false);
    setVerified(false);
  }

  if (sentTo) {
    const resendLabel = cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code';
    const verifyLabel = verified
      ? (busy ? 'Signing you in…' : 'Try again')
      : (busy ? 'Checking…' : 'Verify');
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <MailCheck className="size-6 text-foreground" aria-hidden />
          <h2 className="font-heading text-xl font-semibold tracking-tight">Check your email</h2>
          <p className="text-base text-muted-foreground">We emailed you a code. Enter it below.</p>
          <p className="text-base text-muted-foreground">Sent to <span className="font-medium text-foreground">{sentTo}</span>. Or click the link in the email, in this same browser.</p>
        </div>
        <form onSubmit={onVerify} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sign-in-code">Sign-in code</Label>
            <Input id="sign-in-code" type="text" inputMode="numeric" autoComplete="one-time-code"
              placeholder="Enter code" maxLength={MAX_CODE_LENGTH} value={code} disabled={verified}
              className="money h-14 text-2xl tracking-[0.3em] md:text-2xl"
              onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, MAX_CODE_LENGTH))} />
          </div>
          {error && <p role="alert" className="bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
          {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
          <Button type="submit" size="lg" className="w-full" disabled={busy}>{verifyLabel}</Button>
        </form>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" variant="outline" disabled={busy || cooldown > 0 || verified} onClick={onResend}>{resendLabel}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={useDifferentEmail}>Use a different email</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <OAuthButtons providers={providers} busy={busy} onSelect={onOAuth} />
      <form onSubmit={onSubmitEmail} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" required placeholder="you@example.com"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        {error && <p role="alert" className="bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={busy}>{busy && !redirecting ? 'Sending…' : 'Email me a code'}</Button>
        <p className="text-sm text-muted-foreground">No password. We email you a sign-in code and a link.</p>
      </form>
    </div>
  );
}
