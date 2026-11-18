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
    <Suspense fallback={<Screen width="narrow"><p className="text-sm text-muted-foreground">Checking your invite…</p></Screen>}>
      {Promise.all([params, searchParams]).then(([{ inviteToken }, sp]) => (
        <JoinGate token={inviteToken} linkFailed={sp.error === 'link'} />
      ))}
    </Suspense>
  );
}

// The pot preview is full-bleed (it draws its own frame); every other join state sits in the narrow page frame.
async function JoinGate({ token, linkFailed }: { token: string; linkFailed: boolean }) {
  const supabase = await createServerSupabase();
  const user = await getVerifiedUser(supabase);
  const next = `/join/${encodeURIComponent(token)}`;

  if (!user) {
    const title = await inviteTitle(token);
    if (title === undefined) return <Screen width="narrow"><InviteNotFound /></Screen>;
    return <Screen width="narrow"><SignedOutInvite title={title} linkFailed={linkFailed} next={next} /></Screen>;
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
  if (outcome.kind === 'not-found') return <Screen width="narrow"><InviteNotFound /></Screen>;
  if (outcome.kind === 'left') return <Screen width="narrow"><NoLongerMember /></Screen>;
  return <Screen width="narrow"><WrongEmail email={user.email} /></Screen>;
}
