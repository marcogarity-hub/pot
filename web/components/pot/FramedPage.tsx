import type { ReactNode } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { AppShell } from './AppShell';
import { linkButton } from './linkButton';
import { Screen } from './Screen';
import { loadShell } from './shell.server';

/**
 * A nav page in the signed-in frame. Signed in: the page sits in the sidebar frame. Signed out: `requireSignIn`
 * sends the visitor to sign-in and back to `path`; otherwise the page renders in a plain Screen with a Sign in link.
 * Reads the session cookie, so render it inside a Suspense boundary.
 */
export async function FramedPage({ path, requireSignIn = false, children }: {
  path: string;
  requireSignIn?: boolean;
  children: ReactNode;
}) {
  const supabase = await createServerSupabase();
  const user = await getVerifiedUser(supabase);
  if (!user) {
    if (requireSignIn) redirect(`/sign-in?next=${path}`);
    return (
      <Screen width="wide" nav={<Link href="/sign-in" className={linkButton({ variant: 'glass' })}>Sign in</Link>}>
        {children}
      </Screen>
    );
  }
  const shell = await loadShell(supabase, user);
  // The sidebar and tab bar are the frame, so the page supplies the gutter the Screen would otherwise give it.
  return <AppShell me={shell.me}><div className="px-4 pt-6 md:px-8 md:pt-10">{children}</div></AppShell>;
}
