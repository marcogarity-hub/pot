import { Suspense } from 'react';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase/server';
import { linkButton } from '@/components/pot/linkButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveInvite } from '@/components/pot/auth';
import { inviteTitle, lookupInvite } from '@/components/pot/invite.server';
import { Screen } from '@/components/pot/Screen';
import { SignInForm } from '@/components/pot/SignInForm';
import { SignOutButton } from '@/components/pot/SignOutButton';

export default function JoinPage({ params }: PageProps<'/join/[inviteToken]'>) {
  return (
    <Screen>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Checking your invite…</p>}>
        {params.then(({ inviteToken }) => <JoinGate token={inviteToken} />)}
      </Suspense>
    </Screen>
  );
}

async function JoinGate({ token }: { token: string }) {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  const next = `/join/${encodeURIComponent(token)}`;

  if (!data.user?.email) {
    const title = await inviteTitle(token);
    if (title === undefined) return <NotFound />;
    return (
      <Card>
        <CardHeader>
          <CardTitle>You&apos;re invited{title ? ` to ${title}` : ''}</CardTitle>
          <CardDescription>Sign in with the email your organizer invited to see the pot and pay your share.</CardDescription>
        </CardHeader>
        <CardContent><SignInForm next={next} /></CardContent>
      </Card>
    );
  }

  const outcome = resolveInvite(await lookupInvite(token, data.user.email));
  if (outcome.kind === 'pot') redirect(`/pots/${outcome.potId}`);
  if (outcome.kind === 'not-found') return <NotFound />;
  return (
    <Card>
      <CardHeader>
        <CardTitle>This invite isn&apos;t for your email</CardTitle>
        <CardDescription>You&apos;re signed in as {data.user.email}. Ask the organizer to add this address, or sign in with the one they invited.</CardDescription>
      </CardHeader>
      <CardContent className="flex gap-2">
        <SignOutButton />
        <Link href="/" className={linkButton({ variant: 'outline', size: 'sm' })}>Go home</Link>
      </CardContent>
    </Card>
  );
}

function NotFound() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite not found</CardTitle>
        <CardDescription>This link may be mistyped or the pot may still be confirming. Ask the organizer to send it again.</CardDescription>
      </CardHeader>
      <CardContent><Link href="/" className={linkButton({ variant: 'outline' })}>Go home</Link></CardContent>
    </Card>
  );
}
