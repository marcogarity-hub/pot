'use client';

import Link from 'next/link';
import { cn } from 'cn';
import { PotState } from '@/lib/pot/chain';
import { usePot, type PotStatusRow } from '@/lib/realtime/usePot';
import { Button } from '@/components/ui/button';
import { linkButton } from '@/components/pot/linkButton';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { availableActions, verifiedReceipt } from './actions';
import { useAutoFinalize } from './autoFinalize';
import { formatRemaining, useNow } from './Countdown';
import { InviteLink } from './InviteLink';
import { MemberList } from './MemberList';
import type { MeState } from './meState';
import { PotActions } from './PotActions';
import { ProgressBar } from './ProgressBar';
import { stateInfo, type StateTone } from './potState';
import { useMe } from './useMe';

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
  const info = stateInfo(status);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <StateChip label={info.label} tone={info.tone} />
        <h1 className="font-heading text-3xl font-semibold tracking-tight">{status.title ?? `Pot #${status.pot_id}`}</h1>
        <p className="text-sm text-muted-foreground">{info.next}</p>
      </div>

      <Card className="gap-5 py-5">
        <CardContent>
          <ProgressBar paidCount={inPot} memberCount={active.length} share={status.share} total={status.total}
            aside={<TimeLeft status={status} now={now} />} />
        </CardContent>
      </Card>

      <StateDetail status={status} />

      <IdentityNotice me={me} potId={potId} onRetry={retry} />

      {isOrganizer && status.invite_token && status.state === PotState.Funding && (
        <>
          <Separator />
          <InviteLink token={status.invite_token} />
        </>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Members</h2>
        <MemberList status={status} myAddress={myAddress} />
      </section>

      <PotActions potId={potId} actions={actions} status={status} onSettled={() => { void refetch(); }} />
    </div>
  );
}

const TONE: Record<StateTone, string> = {
  accent: 'bg-accent text-accent-foreground',
  neutral: 'bg-secondary text-secondary-foreground',
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  danger: 'bg-destructive/10 text-destructive',
};

export function StateChip({ label, tone }: { label: string; tone: StateTone }) {
  return (
    <span className={cn('inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold', TONE[tone])}>
      <span aria-hidden className="size-2 rounded-full bg-current" />
      {label}
    </span>
  );
}

/** Time left in the current step, shown beside "N of M paid". Nothing once the window has closed. */
function TimeLeft({ status, now }: { status: PotStatusRow; now: Date }) {
  let label: string | null = null;
  let target: number = NaN;
  if (status.state === PotState.Funding) { label = 'Deadline in'; target = Date.parse(status.deadline); }
  else if (status.state === PotState.Locked && status.locked_at) {
    label = 'Request within';
    target = Date.parse(status.locked_at) + status.request_window_seconds * 1000;
  } else if (status.state === PotState.PayoutRequested && status.release_eligible_at) {
    label = 'Objections close in';
    target = Date.parse(status.release_eligible_at);
  }
  const remaining = target - now.getTime();
  if (!label || !(remaining > 0)) return null;
  return <p className="text-muted-foreground">{label} <span className="money font-semibold text-foreground">{formatRemaining(remaining)}</span></p>;
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

/** Extra detail for states that need it: the payout receipt and objection count. */
function StateDetail({ status }: { status: PotStatusRow }) {
  if (status.state !== PotState.PayoutRequested) return null;
  const receipt = verifiedReceipt(status.receipt_text, status.receipt_hash);
  return (
    <Card>
      <CardContent className="space-y-3 text-sm">
        <p className="text-muted-foreground">The organizer requested the payout with this receipt:</p>
        {receipt ? <p className="whitespace-pre-wrap rounded-xl bg-muted p-3 font-medium">{receipt}</p>
          : <p className="rounded-xl bg-muted p-3 text-muted-foreground">Receipt pending</p>}
        <p className="money">{status.objections_count} of {status.threshold} objections needed to block it</p>
      </CardContent>
    </Card>
  );
}
