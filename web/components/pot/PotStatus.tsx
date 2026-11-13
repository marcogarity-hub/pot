'use client';

import Link from 'next/link';
import { PotState } from '@/lib/pot/chain';
import { usePot, type PotStatusRow } from '@/lib/realtime/usePot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { linkButton } from '@/components/pot/linkButton';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { availableActions, verifiedReceipt } from './actions';
import { useAutoFinalize } from './autoFinalize';
import { Countdown, useNow } from './Countdown';
import { InviteLink } from './InviteLink';
import { MemberList } from './MemberList';
import type { MeState } from './meState';
import { PotActions } from './PotActions';
import { ProgressBar } from './ProgressBar';
import { useMe } from './useMe';

const STATE_LABEL: Record<number, string> = {
  [PotState.Funding]: 'Collecting',
  [PotState.Locked]: 'Locked',
  [PotState.PayoutRequested]: 'Payout requested',
  [PotState.Released]: 'Paid out',
  [PotState.Frozen]: 'Frozen',
};

export function PotStatus({ potId }: { potId: string }) {
  const { status, loading, refetch } = usePot(potId);
  const { me, loading: meLoading, retry } = useMe();
  const now = useNow();
  // Only a signed-in viewer with a wallet (`ready`) gets pot actions.
  const ready = me?.kind === 'ready' ? me : null;
  const actions = status && ready ? availableActions(status, ready.wallet_address, now) : [];
  useAutoFinalize(potId, actions.includes('finalize'));

  if (loading || meLoading || me === null) return <p className="text-sm text-muted-foreground">Loading pot…</p>;
  if (!status) {
    return (
      <Card>
        <CardContent className="space-y-3 text-sm">
          <p className="font-medium">We couldn&apos;t find this pot.</p>
          <p className="text-muted-foreground">It may still be confirming on-chain, or you aren&apos;t a member.</p>
          <IdentityNotice me={me} potId={potId} onRetry={retry} />
        </CardContent>
      </Card>
    );
  }

  const myAddress = ready?.wallet_address ?? null;
  const isOrganizer = !!ready && (!!status.is_organizer || (!!myAddress && status.organizer_address.toLowerCase() === myAddress.toLowerCase()));
  const active = status.members.filter(m => m.active);
  const inPot = status.members.filter(m => m.has_paid && !m.has_refunded).length;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge variant={status.state === PotState.Frozen ? 'destructive' : status.state === PotState.Released ? 'secondary' : 'default'}>
          {STATE_LABEL[status.state] ?? 'Unknown'}
        </Badge>
        <h1 className="text-2xl font-semibold tracking-tight">{status.title ?? `Pot #${status.pot_id}`}</h1>
      </div>

      <ProgressBar paidCount={inPot} memberCount={active.length} share={status.share} total={status.total} />
      <StateDetail status={status} now={now} />

      <IdentityNotice me={me} potId={potId} onRetry={retry} />
      <PotActions potId={potId} actions={actions} status={status} onSettled={() => { void refetch(); }} />

      {isOrganizer && status.invite_token && status.state === PotState.Funding && (
        <>
          <Separator />
          <InviteLink token={status.invite_token} />
        </>
      )}

      <Separator />
      <section className="space-y-3">
        <h2 className="text-sm font-medium">Members</h2>
        <MemberList status={status} myAddress={myAddress} />
      </section>
    </div>
  );
}

/** Says why the viewer has no actions. `ready` renders nothing. */
function IdentityNotice({ me, potId, onRetry }: { me: MeState | null; potId: string; onRetry(): void }) {
  if (me === null || me.kind === 'ready') return null;
  if (me.kind === 'no-wallet') {
    return <p className="text-sm text-muted-foreground">You&apos;re signed in but not part of this pot yet.</p>;
  }
  if (me.kind === 'error') {
    return (
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">We couldn&apos;t check your account. Check your connection and try again.</p>
        <Button variant="outline" size="sm" onClick={onRetry}>Try again</Button>
      </div>
    );
  }
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">Sign in to take actions on this pot.</p>
      <Link href={`/sign-in?next=/pots/${potId}`} className={linkButton({ size: 'sm' })}>Sign in</Link>
    </div>
  );
}

function StateDetail({ status, now }: { status: PotStatusRow; now: Date }) {
  switch (status.state) {
    case PotState.Funding:
      return <Countdown target={status.deadline} now={now} label="Deadline in" doneLabel="The deadline has passed. Anyone who paid can get a refund." />;
    case PotState.Locked: {
      const expiresAt = new Date(Date.parse(status.locked_at ?? '') + status.request_window_seconds * 1000).toISOString();
      return (
        <div className="space-y-1">
          <p className="text-sm">Everyone paid. The money is locked until the organizer requests the payout.</p>
          {status.locked_at && <Countdown target={expiresAt} now={now} label="Organizer must request within" doneLabel="The request window has closed. Anyone can expire the pot to open refunds." />}
        </div>
      );
    }
    case PotState.PayoutRequested: {
      const receipt = verifiedReceipt(status.receipt_text, status.receipt_hash);
      return (
        <Card>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">The organizer requested the payout with this receipt:</p>
            {receipt ? <p className="whitespace-pre-wrap rounded-md bg-muted p-3 font-medium">{receipt}</p>
              : <p className="rounded-md bg-muted p-3 text-muted-foreground">Receipt pending</p>}
            <p className="tabular-nums">{status.objections_count} of {status.threshold} objections needed to block it</p>
            {status.release_eligible_at && <Countdown target={status.release_eligible_at} now={now} label="Objections close in" doneLabel="The objection window has closed." />}
          </CardContent>
        </Card>
      );
    }
    case PotState.Released:
      return <p className="text-sm">The money was released to the organizer.</p>;
    case PotState.Frozen:
      return <p className="text-sm">This pot is frozen. Everyone who paid can take their share back.</p>;
    default:
      return null;
  }
}
