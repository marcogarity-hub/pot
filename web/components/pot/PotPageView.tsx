import type { ReactNode } from 'react';
import { cn } from 'cn';
import { formatUnits } from 'viem';
import { PotState } from '@/lib/pot/chain';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { verifiedReceipt } from './actions';
import { MemberList } from './MemberList';
import { PotLifecycle, lifecycleSteps } from './PotLifecycle';
import { formatWindow } from './PotActions';
import { ProgressBar } from './ProgressBar';
import { StateLabel } from './StateLabel';
import { stateInfo } from './potState';

/**
 * The pot page as a pure view over loaded data, so a fixture can render it. `actions`, `notice` and `invite`
 * are slots: the real page fills them with client components that hold the handlers.
 */
export function PotPageView({ status, nowMs, myAddress, isOrganizer, actions, notice, invite }: {
  status: PotStatusRow; nowMs: number; myAddress: string | null; isOrganizer: boolean;
  actions: ReactNode; notice: ReactNode; invite: ReactNode;
}) {
  const info = stateInfo(status);
  const me = myAddress?.toLowerCase() ?? null;
  const isMember = me !== null && status.members.some(m => m.address.toLowerCase() === me);
  const line = isOrganizer ? 'You organize this pot' : isMember ? 'You are a member' : null;
  const active = status.members.filter(m => m.active);
  const inPot = status.members.filter(m => m.has_paid && !m.has_refunded).length;
  const receipt = verifiedReceipt(status.receipt_text, status.receipt_hash);
  const usdc = (wei: string) => `${formatUnits(BigInt(wei), 18)} USDC`;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
      <header className="min-w-0 space-y-3 border border-border bg-card p-5 md:col-span-12 md:p-8">
        <h1 className="break-words font-heading text-3xl font-semibold tracking-tight md:text-5xl">{status.title ?? `Pot #${status.pot_id}`}</h1>
        <StateLabel info={info} />
        {line && <p className="text-sm text-muted-foreground">{line}</p>}
      </header>

      <div className="min-w-0 space-y-6 md:col-span-8">
        <section aria-labelledby="next-step" className="min-w-0 space-y-4 border border-border bg-card p-5 md:p-6">
          <h2 id="next-step" className="text-lg font-semibold">Your next step</h2>
          {actions}
          {notice}
        </section>

        <section aria-labelledby="lifecycle" className="min-w-0 space-y-4 border border-border bg-card p-5 md:p-6">
          <h2 id="lifecycle" className="text-lg font-semibold">Lifecycle</h2>
          <PotLifecycle steps={lifecycleSteps(status, nowMs)} />
        </section>

        <section aria-labelledby="members" className="min-w-0 space-y-4 border border-border bg-card p-5 md:p-6">
          <h2 id="members" className="text-lg font-semibold">Members</h2>
          <ProgressBar paidCount={inPot} memberCount={active.length} members={status.members} />
          <MemberList status={status} myAddress={myAddress} />
        </section>
      </div>

      <div className="min-w-0 space-y-6 md:col-span-4">
        <section aria-labelledby="details" className="min-w-0 border border-border bg-card p-5">
          <h2 id="details" className="text-lg font-semibold">Details</h2>
          <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
            <DetailRow label="Total"><span className="money">{usdc(status.total)}</span></DetailRow>
            <DetailRow label="Each member pays"><span className="money">{usdc(status.share)}</span></DetailRow>
            <DetailRow label="Deadline"><span className="money">{formatWhen(status.deadline)}</span></DetailRow>
            <DetailRow label="Request window"><span className="money">{formatWindow(status.request_window_seconds)}</span></DetailRow>
            <DetailRow label="Objection window"><span className="money">{formatWindow(status.objection_window_seconds)}</span></DetailRow>
            <DetailRow label="Objection threshold">
              <span className="money">{status.threshold}</span>
              {status.state === PotState.PayoutRequested && (
                <span className="block text-muted-foreground">{status.objections_count} of {status.threshold} objections needed to block it</span>
              )}
            </DetailRow>
            {(receipt || status.state === PotState.PayoutRequested) && (
              <div className="min-w-0 space-y-1 py-3">
                <dt className="text-muted-foreground">Receipt</dt>
                <dd className={cn('whitespace-pre-wrap break-words font-medium', !receipt && 'text-muted-foreground')}>
                  {receipt ?? 'Receipt pending'}
                </dd>
              </div>
            )}
          </dl>
        </section>

        {invite && <section aria-label="Invite" className="min-w-0 border border-border bg-card p-5">{invite}</section>}
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 max-w-full break-words text-right font-medium">{children}</dd>
    </div>
  );
}

const formatWhen = (iso: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
