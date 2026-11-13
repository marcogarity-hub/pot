'use client';

import { useState, type FormEvent } from 'react';
import { MailCheck } from 'lucide-react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { magicLinkRedirect } from './auth';

/** Magic-link sign-in. `next` is kept through the callback (e.g. /join/<token>). */
export function SignInForm({ next }: { next: string }) {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const normalized = email.trim().toLowerCase();
    if (!normalized || sending) return;
    setSending(true);
    setError(null);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
    const { error: err } = await createBrowserSupabase().auth.signInWithOtp({
      email: normalized,
      options: { emailRedirectTo: magicLinkRedirect(appUrl, next) },
    });
    setSending(false);
    if (err) setError(err.message);
    else setSentTo(normalized);
  }

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <MailCheck className="size-10 text-primary" aria-hidden />
        <p className="font-medium">Check your email</p>
        <p className="text-sm text-muted-foreground">We sent a sign-in link to <span className="font-medium text-foreground">{sentTo}</span>. Open it on this device.</p>
        <Button variant="ghost" size="sm" onClick={() => setSentTo(null)}>Use a different email</Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" required placeholder="you@example.com"
          value={email} onChange={e => setEmail(e.target.value)} />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={sending}>{sending ? 'Sending…' : 'Email me a sign-in link'}</Button>
      <p className="text-xs text-muted-foreground">No password. We create a wallet for you the first time you sign in.</p>
    </form>
  );
}
