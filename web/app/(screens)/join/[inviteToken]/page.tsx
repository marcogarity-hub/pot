import { Suspense } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { resolveInvite } from '@/components/pot/auth';
import { inviteTitle, lookupInvite, potSummary } from '@/components/pot/invite.server';
import { claimUser } from '@/lib/circle/identity';
import { JoinPreview } from '@/components/pot/JoinPreview';
import { Screen } from '@/components/pot/Screen';
import { InviteNotFound, NoLongerMember, SignedOutInvite, WrongEmail } from './JoinStates';

export default function JoinPage({ params, searchParams }: PageProps<'/join/[inviteToken]'>) {
  return (
    <Screen width="narrow">
      <Suspense fallback={<p className="text-sm text-muted-foreground">Checking your invite…</p>}>
        {Promise.all([params, searchParams]).then(([{ inviteToken }, sp]) => (
          <JoinGate token={inviteToken} linkFailed={sp.error === 'link'} />
        ))}
      </Suspense>
    </Screen>
  );
}

async function JoinGate({ token, linkFailed }: { token: string; linkFailed: boolean }) {
  const supabase = await createServerSupabase();
  const user = await getVerifiedUser(supabase);
  const next = `/join/${encodeURIComponent(token)}`;

  if (!user) {
    const title = await inviteTitle(token);
    if (title === undefined) return <InviteNotFound />;
    return <SignedOutInvite title={title} linkFailed={linkFailed} next={next} />;
  }

  const outcome = resolveInvite(await lookupInvite(token, user.email));
  if (outcome.kind === 'pot') {
    try {
      await claimUser(user.id, user.email);
    } catch (err) {
      console.error('[join] claim skipped:', JSON.stringify({ name: err instanceof Error ? err.name : 'UnknownError' }));
    }
    const [summary, { data: me }] = await Promise.all([
      potSummary(outcome.potId),
      supabase.from('users').select('display_name').eq('auth_user_id', user.id).maybeSingle(),
    ]);
    return (
      <JoinPreview potId={outcome.potId} title={summary.title ?? 'a pot'} amount={summary.amount}
        organizerEmail={summary.organizerEmail} organizerName={summary.organizerName}
        email={user.email} name={(me as { display_name: string | null } | null)?.display_name ?? null} />
    );
  }
  if (outcome.kind === 'not-found') return <InviteNotFound />;
  if (outcome.kind === 'left') return <NoLongerMember />;
  return <WrongEmail email={user.email} />;
}
