import type { ReactNode } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { AppShell } from './AppShell';
import { loadShell } from './shell.server';

/**
 * Wraps a page in the signed-in frame (sidebar on desktop, tab bar on phones) when the visitor is signed in,
 * and renders it untouched when they are not. Reads the session cookie, so use it inside a Suspense boundary.
 * `activePotId` is accepted for the pot page, which still passes it; the frame no longer uses it.
 */
export async function SignedInFrame({ hideTabBar, children }: { activePotId?: string; hideTabBar?: boolean; children: ReactNode }) {
  const supabase = await createServerSupabase();
  const user = await getVerifiedUser(supabase);
  if (!user) return <>{children}</>;
  const shell = await loadShell(supabase, user);
  return <AppShell me={shell.me} hideTabBar={hideTabBar}>{children}</AppShell>;
}
