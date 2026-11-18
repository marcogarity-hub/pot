import type { ReactNode } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { AppShell } from './AppShell';
import { loadShell } from './shell.server';

/** The server render's clock, read outside the component so the render itself stays pure. */
const requestTime = () => Date.now();

/**
 * Wraps a page in the signed-in frame (sidebar on desktop, tab bar on phones) when the visitor is signed in,
 * and renders it untouched when they are not. Reads the session cookie, so use it inside a Suspense boundary.
 */
export async function SignedInFrame({ activePotId, hideTabBar, children }: { activePotId?: string; hideTabBar?: boolean; children: ReactNode }) {
  const supabase = await createServerSupabase();
  const user = await getVerifiedUser(supabase);
  if (!user) return <>{children}</>;
  const shell = await loadShell(supabase, user, requestTime());
  return <AppShell me={shell.me} pots={shell.pots} activePotId={activePotId} hideTabBar={hideTabBar}>{children}</AppShell>;
}
