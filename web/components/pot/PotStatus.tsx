'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { PotState } from '@/lib/pot/chain';
import { usePot } from '@/lib/realtime/usePot';
import { Button } from '@/components/ui/button';
import { linkButton } from '@/components/pot/linkButton';
import { availableActions } from './actions';
import { useAutoFinalize } from './autoFinalize';
import { useNow } from './Countdown';
import { InviteLink } from './InviteLink';
import type { MeState } from './meState';
import { PotActions } from './PotActions';
import { PotPageView } from './PotPageView';
import { stateInfo } from './potState';
import { useMe } from './useMe';

export function PotStatus({ potId }: { potId: string }) {
  const { status, loading, refetch } = usePot(potId);
  const { me, loading: meLoading, retry } = useMe();
  const now = useNow();
  // Only a signed-in viewer with a wallet (`ready`) gets pot actions.
  const ready = me?.kind === 'ready' ? me : null;
  const actions = status && ready ? availableActions(status, ready.wallet_address, now) : [];
  useAutoFinalize(potId, actions.includes('finalize'));

  if (loading || meLoading || me === null) return <Frame><p className="text-[15px] text-muted-foreground">Loading plan…</p></Frame>;
  if (!status) {
    return (
      <Frame>
        <div className="space-y-3 rounded-group bg-card p-5 text-[15px]">
          <p className="font-semibold">We couldn&apos;t find this plan.</p>
          <p className="text-muted-foreground">It may still be confirming on-chain, or you aren&apos;t a member.</p>
        </div>
        <IdentityNotice me={me} potId={potId} onRetry={retry} />
      </Frame>
    );
  }

  const myAddress = ready?.wallet_address ?? null;
  const isOrganizer = !!ready && (!!status.is_organizer || (!!myAddress && status.organizer_address.toLowerCase() === myAddress.toLowerCase()));

  return (
    <PotPageView
      status={status}
      nowMs={now.getTime()}
      myAddress={myAddress}
      isOrganizer={isOrganizer}
      actions={
        <PotActions potId={potId} actions={actions} status={status} idleText={stateInfo(status).next}
          onSettled={() => { void refetch(); }} onAuthLost={retry} />
      }
      notice={<IdentityNotice me={me} potId={potId} onRetry={retry} />}
      invite={isOrganizer && status.invite_token && status.state === PotState.Funding
        ? <InviteLink token={status.invite_token} />
        : null}
    />
  );
}

/** The page's frame when there is no pot to show yet: safe-area top, one column, and a way back. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div className="pt-safe">
      <div className="mx-auto w-full max-w-2xl space-y-3 px-4 py-6 md:max-w-5xl md:px-10">
        <Link href="/" className="text-[15px] font-medium underline underline-offset-4">Back to plans</Link>
        {children}
      </div>
    </div>
  );
}

/** Says why the viewer has no actions. `ready` renders nothing. */
function IdentityNotice({ me, potId, onRetry }: { me: MeState | null; potId: string; onRetry(): void }) {
  if (me === null || me.kind === 'ready') return null;
  if (me.kind === 'no-wallet') {
    return (
      <div className="space-y-1 rounded-group bg-card p-5 text-[15px] text-muted-foreground">
        <p>You&apos;re signed in but not part of this plan yet.</p>
        <p>Open the invite link the organizer sent you to join it.</p>
      </div>
    );
  }
  if (me.kind === 'error') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-group bg-card p-5 text-[15px]">
        <p className="text-muted-foreground">We couldn&apos;t check your account. Check your connection and try again.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-group bg-card p-5 text-[15px]">
      <p className="text-muted-foreground">Sign in to take actions on this plan.</p>
      <Link href={`/sign-in?next=/pots/${potId}`} className={linkButton({ size: 'sm' })}>Sign in</Link>
    </div>
  );
}
