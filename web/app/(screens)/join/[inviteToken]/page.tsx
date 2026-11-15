import { Suspense } from 'react';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { linkButton } from '@/components/pot/linkButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { resolveInvite } from '@/components/pot/auth';
import { inviteTitle, lookupInvite, potSummary } from '@/components/pot/invite.server';
import { JoinPreview } from '@/components/pot/JoinPreview';
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
  if (outcome.kind === 'pot') {
    const summary = await potSummary(outcome.potId);
    return (
      <JoinPreview potId={outcome.potId} title={summary.title ?? 'a pot'} amount={summary.amount}
        organizerEmail={summary.organizerEmail} email={data.user.email} />
    );
  }
  if (outcome.kind === 'not-found') return <NotFound />;
  if (outcome.kind === 'left') return <NoLongerMember />;
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

function NoLongerMember() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>You&apos;re no longer in this pot.</CardTitle>
        <CardDescription>Your seat was given to someone else. Ask the organizer if you think this is a mistake.</CardDescription>
      </CardHeader>
      <CardContent><Link href="/" className={linkButton({ variant: 'outline' })}>Go home</Link></CardContent>
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
