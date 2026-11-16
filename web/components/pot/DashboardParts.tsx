import Link from 'next/link';
import { ArrowRight, ChevronRight, CalendarClock, CircleCheck, CreditCard, Hourglass, RotateCcw, Send } from 'lucide-react';
import { formatUnits } from 'viem';
import { cn } from 'cn';
import type { ActivityItem, QueueItem } from './dashboardModel';

/** USDC in 18-decimal units as "1,234.50". Sub-cent amounts say so instead of rounding to zero. */
export function formatUsdc(wei: bigint): string {
  if (wei > BigInt(0) && wei < BigInt('10000000000000000')) return '<0.01';
  const [whole, frac = ''] = formatUnits(wei, 18).split('.');
  return `${BigInt(whole).toLocaleString('en-US')}.${(frac + '00').slice(0, 2)}`;
}

export type StateCounts = { funding: number; locked: number; payout: number; released: number; closed: number };

/** The one big figure on the grid: money held in escrow now, then a ruler of how many pots sit in each stage. */
export function HeldSummary({ held, potCount, needsCount, counts }: {
  held: bigint; potCount: number; needsCount: number; counts: StateCounts;
}) {
  const stages: Array<[string, number]> = [
    ['Funding', counts.funding], ['Locked', counts.locked], ['Payout', counts.payout],
    ['Released', counts.released], ['Closed', counts.closed],
  ];
  const sentence = potCount === 0
    ? 'You are not in any pot yet.'
    : `${potCount} ${potCount === 1 ? 'pot' : 'pots'}, ${needsCount === 0 ? 'nothing needs you' : `${needsCount} ${needsCount === 1 ? 'needs' : 'need'} you`}.`;
  return (
    <section aria-label="Money held" className="tick border border-border bg-card">
      <div className="p-5 md:p-8">
        <p className="text-sm font-medium text-muted-foreground">Held in escrow</p>
        <p className="money mt-2 font-heading font-semibold leading-none tracking-tight [font-variation-settings:'wdth'_125]">
          <span className="text-5xl md:text-8xl">{formatUsdc(held)}</span>
          <span className="ml-3 text-lg font-medium text-muted-foreground md:text-2xl">USDC</span>
        </p>
        <p className="mt-4 text-sm">{sentence} <span className="text-muted-foreground">Test USDC on Arc testnet.</span></p>
      </div>
      <dl className="grid grid-cols-5 divide-x divide-border border-t border-border">
        {stages.map(([label, n]) => (
          <div key={label} className="px-3 py-3 md:px-5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="money font-heading text-xl font-semibold">{n}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const ACTION_ICON = {
  pay: CreditCard, 'request-payout': Send, 'review-payout': Hourglass, finalize: CircleCheck, refund: RotateCcw,
} as const;

/** One next action per pot, most urgent first. */
export function NeedsYou({ items }: { items: QueueItem[] }) {
  return (
    <section aria-labelledby="needs-you" className="space-y-3">
      <h2 id="needs-you" className="flex items-baseline gap-2 text-lg font-semibold">
        Needs you <span className="money text-sm font-medium text-muted-foreground">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="border border-border bg-card p-4 text-sm text-muted-foreground">Nothing needs you right now.</p>
      ) : (
        <ul className="divide-y divide-border border border-border bg-card">
          {items.map(item => {
            const Icon = ACTION_ICON[item.action];
            return (
              <li key={`${item.potId}-${item.action}`}>
                <Link href={item.href} className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-secondary/60 md:px-5">
                  <span className="grid size-10 shrink-0 place-items-center bg-primary text-primary-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{item.label}</span>
                    <span className="block text-sm text-muted-foreground">{item.potTitle} · {item.hint}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** The two ways to begin: the form as it opens (2-minute demo windows), or with the production windows selected. */
export function StartTiles() {
  return (
    <section aria-label="Start a pot" className="grid h-full gap-px border border-border bg-border">
      <Link href="/new" className="group flex flex-col justify-between gap-6 bg-primary p-5 text-primary-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary),black_16%)] md:p-6">
        <span className="font-heading text-2xl font-semibold leading-tight">Start a pot</span>
        <span className="flex items-end justify-between gap-3 text-sm">
          Collect equal shares from a group.
          <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
      <Link href="/new?preset=booking" className="group flex flex-col justify-between gap-6 bg-card p-5 transition-colors hover:bg-secondary/60 md:p-6">
        <span className="flex items-center gap-2 font-heading text-lg font-semibold leading-tight"><CalendarClock className="size-4 text-primary" aria-hidden />Plan a real booking</span>
        <span className="flex items-end justify-between gap-3 text-sm text-muted-foreground">
          48-hour objection window, 7-day request window.
          <ArrowRight className="size-5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
    </section>
  );
}

const MARKER: Record<ActivityItem['tone'], string> = {
  neutral: 'bg-input', money: 'bg-primary', warn: 'bg-warning', bad: 'bg-destructive',
};

/** Recent contract events in the viewer's pots, newest first. Events carry no timestamp, so order is the only time cue. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section aria-labelledby="activity" className="space-y-3">
      <h2 id="activity" className="text-lg font-semibold">Activity</h2>
      {items.length === 0 ? (
        <p className="border border-border bg-card p-4 text-sm text-muted-foreground">Payments and payouts in your pots show up here.</p>
      ) : (
        <ol className="divide-y divide-border border border-border bg-card">
          {items.map(item => (
            <li key={item.id}>
              <Link href={`/pots/${item.potId}`} className="flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/60">
                <span aria-hidden className={cn('mt-1.5 size-2 shrink-0', MARKER[item.tone])} />
                <span className="min-w-0">
                  <span className="block">{item.text}</span>
                  <span className="block truncate text-xs text-muted-foreground">{item.potTitle}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
