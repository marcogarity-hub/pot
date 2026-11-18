'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';

/** Signs this account out on every device. Asks once before doing it, since it cannot be undone from here. */
export function SecuritySection() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function logOutEverywhere() {
    setBusy(true);
    setError(null);
    const { error: signOutError } = await createBrowserSupabase().auth.signOut({ scope: 'global' });
    if (signOutError) {
      setBusy(false);
      setError('We could not log you out everywhere. Try again.');
      return;
    }
    router.replace('/');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <h2 className="text-[22px] font-semibold">Security</h2>
      {!confirming ? (
        <div className="space-y-3">
          <p className="text-[15px] text-muted-foreground">Sign out of Pot on every device where you are signed in.</p>
          <Button variant="outline" onClick={() => setConfirming(true)}>Log out of all devices</Button>
        </div>
      ) : (
        <div className="space-y-4 rounded-group bg-card p-5">
          <p className="text-[15px]">This signs you out on every device, including this one. Are you sure?</p>
          <div className="flex flex-wrap gap-3">
            <Button variant="destructive" disabled={busy} onClick={logOutEverywhere}>
              {busy ? 'Logging out…' : 'Log out everywhere'}
            </Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
