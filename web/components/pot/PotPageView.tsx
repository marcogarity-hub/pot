import { AppLink } from '@/components/pot/demo/DemoContext';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import { PotState } from '@/lib/pot/chain';
import { formatDollars } from '@/lib/format/money';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { verifiedReceipt } from './actions';
import { Countdown } from './Countdown';
import type { Face } from './Faces';
import { MemberList } from './MemberList';
import { PotLifecycle, lifecycleSteps } from './PotLifecycle';
import { formatWindow } from './PotActions';
import { ProgressBar } from './ProgressBar';
import { StateLabel } from './StateLabel';
import { TripCover } from './TripCover';
import { stateInfo } from './potState';

/**
 * The pot page as a pure view over loaded data, so a fixture can render it. `actions`, `notice` and `invite`
 * are slots: the real page fills them with client components that hold the handlers. The primary action
 * floats in a glass toolbar that `actions` draws itself.
 */
export function PotPageView({ status, nowMs, myAddress, isOrganizer, actions, notice, invite }: {
  status: PotStatusRow; nowMs: number; myAddress: string | null; isOrganizer: boolean;
  actions: ReactNode; notice: ReactNode; invite: ReactNode;
}) {
  const info = stateInfo(status);
  const me = myAddress?.toLowerCase() ?? null;
  const isMember = me !== null && status.members.some(m => m.address.toLowerCase() === me);
  const line = isOrganizer ? 'You organize' : isMember ? 'You are a member' : null;
  const active = status.members.filter(m => m.active);
  const inPot = status.members.filter(m => m.has_paid && !m.has_refunded).length;
  const receipt = verifiedReceipt(status.receipt_text, status.receipt_hash);
  // Seats follow the server's member order, the same numbering MemberList uses, so colours stay put.
  const faces: Face[] = status.members.flatMap((m, i) => (m.active
    ? [{ seat: i + 1, name: m.name, email: m.email, paid: m.has_paid && !m.has_refunded }]
    : []));

  return (
    <>
      {/* Desktop: the cover runs from the window's left edge, so the sidebar floats over its left end. */}
      <div className="relative md:-ml-[264px] md:w-[calc(100%+264px)]">
        <TripCover potId={status.pot_id} title={status.title} className="h-[300px] w-full md:h-[360px] lg:h-[420px]" />
        {/* Desktop only: the art fades into the warm page under the title block. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-40 bg-gradient-to-b from-transparent to-background md:block" />
        <AppLink href="/" aria-label="Back to plans"
          style={{ marginTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          className="glass-art absolute left-4 top-0 flex size-11 items-center justify-center rounded-full text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring md:hidden">
          <ChevronLeft aria-hidden className="size-6" strokeWidth={2} />
        </AppLink>
        <nav aria-label="Breadcrumb"
          style={{ marginTop: 'calc(env(safe-area-inset-top, 0px) + 12px)' }}
          className="glass-art absolute left-6 top-0 hidden h-11 max-w-[60%] items-center gap-2 rounded-full px-4 text-[15px] font-semibold text-white md:flex md:left-[304px]">
          <AppLink href="/" className="shrink-0 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Plans</AppLink>
          <ChevronRight aria-hidden className="size-4 shrink-0" strokeWidth={2} />
          <span aria-current="page" className="min-w-0 truncate">{status.title ?? `Plan #${status.pot_id}`}</span>
        </nav>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pb-44 pt-5 md:max-w-7xl md:px-10 md:pb-32 md:pt-0">
        <header className="min-w-0 space-y-2 md:relative md:z-10 md:-mt-24">
          <StateLabel info={info} />
          <h1 className="break-words font-heading text-[34px] leading-[1.05] tracking-tight md:text-[56px] md:leading-[1]">{status.title ?? `Plan #${status.pot_id}`}</h1>
          <p className="text-[17px] text-muted-foreground">
            {line && <><span>{line}</span> · </>}
            <span>{formatDollars(status.share)} each</span>
          </p>
        </header>

        <div className="space-y-6 xl:grid xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start xl:gap-8 xl:space-y-0">
          <div className="min-w-0 space-y-6">
            <ProgressBar
              paidCount={inPot}
              memberCount={active.length}
              collected={formatDollars(BigInt(status.share) * BigInt(inPot))}
              total={formatDollars(status.total)}
              faces={faces}
              footer={status.state === PotState.Funding
                ? <Countdown target={status.deadline} now={new Date(nowMs)} label="Deadline in" doneLabel="Deadline passed" />
                : null}
            />

            {(receipt || status.state === PotState.PayoutRequested) && (
              <section aria-labelledby="request" className="space-y-3">
                <h2 id="request" className="px-1 text-[22px] font-semibold tracking-tight">The request</h2>
                <div className="divide-y divide-border overflow-hidden rounded-group bg-card">
                  <div className="min-w-0 space-y-1 px-5 py-4">
                    <p className="text-[15px] text-muted-foreground">Receipt</p>
                    <p className={cn('whitespace-pre-wrap break-words text-[17px]', !receipt && 'text-muted-foreground')}>
                      {receipt ?? 'Receipt pending'}
                    </p>
                  </div>
                  {status.state === PotState.PayoutRequested && (
                    <div className="space-y-2 px-5 py-4">
                      {status.release_eligible_at && (
                        <Countdown target={status.release_eligible_at} now={new Date(nowMs)} label="Objections close in" doneLabel="Objections closed" />
                      )}
                      <p className="money text-[17px] font-semibold">{status.objections_count} of {status.threshold} objections</p>
                      <p className="text-[15px] text-muted-foreground">needed to block it</p>
                    </div>
                  )}
                </div>
              </section>
            )}

            <div className="space-y-4">
              {actions}
              {notice}
            </div>

            <section aria-labelledby="members" className="space-y-3">
              <h2 id="members" className="px-1 text-[22px] font-semibold tracking-tight">The group</h2>
              <MemberList status={status} myAddress={myAddress} />
            </section>
          </div>

          <div className="min-w-0 space-y-6">
            {invite && <section aria-label="Invite">{invite}</section>}

            <section aria-labelledby="lifecycle" className="space-y-3">
              <h2 id="lifecycle" className="px-1 text-[22px] font-semibold tracking-tight">Where it&apos;s at</h2>
              <div className="rounded-group bg-card p-5">
                <PotLifecycle steps={lifecycleSteps(status, nowMs)} />
              </div>
            </section>

            <section aria-labelledby="details" className="space-y-3">
              <h2 id="details" className="px-1 text-[22px] font-semibold tracking-tight">Details</h2>
              <dl className="divide-y divide-border overflow-hidden rounded-group bg-card text-[17px]">
                <DetailRow label="Held in">USDC on Arc</DetailRow>
                <DetailRow label="Total">{formatDollars(status.total)}</DetailRow>
                <DetailRow label="Each member pays">{formatDollars(status.share)}</DetailRow>
                <DetailRow label="Deadline">{formatWhen(status.deadline)}</DetailRow>
                <DetailRow label="Request window">{formatWindow(status.request_window_seconds)}</DetailRow>
                <DetailRow label="Objection window">{formatWindow(status.objection_window_seconds)}</DetailRow>
                <DetailRow label="Objection threshold">{status.threshold}</DetailRow>
                {status.receipt_hash && (
                  <DetailRow label="Receipt hash"><span className="font-mono text-[15px] break-all">{status.receipt_hash}</span></DetailRow>
                )}
              </dl>
              <p className="px-1 text-[13px] text-muted-foreground">
                Test money only: USDC on the Arc testnet. <AppLink href="/privacy" className="underline">Privacy</AppLink>
              </p>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 max-w-full break-words text-right">{children}</dd>
    </div>
  );
}

const formatWhen = (iso: string) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
