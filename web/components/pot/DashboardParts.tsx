import Link from 'next/link';
import { CalendarClock, ChevronRight } from 'lucide-react';
import { cn } from 'cn';
import { formatDollars } from '@/lib/format/money';
import { linkButton } from './linkButton';
import { Faces } from './Faces';
import type { ActivityItem, QueueItem } from './dashboardModel';

export type StateCounts = { funding: number; locked: number; payout: number; released: number; closed: number };

/** Money held across the viewer's pots as one quiet card: "$840 held in 3 pots", then how many need them. */
export function HeldSummary({ held, potCount, needsCount, counts }: {
  held: bigint; potCount: number; needsCount: number; counts: StateCounts;
}) {
  const stages: Array<[string, number]> = [
    ['Funding', counts.funding], ['Locked', counts.locked], ['Payout', counts.payout],
    ['Released', counts.released], ['Closed', counts.closed],
  ];
  return (
    <section aria-label="Money held" className="rounded-group bg-card p-5">
      {potCount === 0 ? (
        <p className="text-[17px]">You are not in any pot yet.</p>
      ) : (
        <>
          <p className="money font-heading text-[28px] font-semibold leading-tight tracking-tight">
            {formatDollars(held)} held in {potCount} {potCount === 1 ? 'pot' : 'pots'}
          </p>
          <p className="mt-1 text-[15px] text-muted-foreground">
            {needsCount === 0 ? 'Nothing needs you.' : `${needsCount} ${needsCount === 1 ? 'needs' : 'need'} you.`}
          </p>
        </>
      )}
      <dl className="mt-4 grid grid-cols-5 gap-1 text-center">
        {stages.map(([label, n]) => (
          <div key={label}>
            <dt className="text-[12px] text-muted-foreground">{label}</dt>
            <dd className="money text-[17px] font-semibold">{n}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** One next action per pot, most urgent first. Each row shows the people it is about and the countdown in its hint. */
export function NeedsYou({ items }: { items: QueueItem[] }) {
  return (
    <section aria-labelledby="needs-you" className="space-y-3">
      <h2 id="needs-you" className="flex items-baseline gap-2 text-[22px] font-semibold">
        Needs you <span className="money text-[15px] font-medium text-muted-foreground">{items.length}</span>
      </h2>
      {items.length === 0 ? (
        <p className="rounded-group bg-card p-4 text-[15px] text-muted-foreground">Nothing needs you right now.</p>
      ) : (
        <ul className="divide-y divide-border rounded-group bg-card lg:grid lg:grid-cols-2 lg:gap-4 lg:divide-y-0 lg:bg-transparent">
          {items.map(item => (
            <li key={`${item.potId}-${item.action}`}>
              <Link href={item.href} className="flex min-h-[64px] items-center gap-3 rounded-group px-4 py-3 transition-colors hover:bg-secondary/60 lg:h-full lg:flex-col lg:items-stretch lg:gap-3 lg:bg-card lg:p-5 lg:hover:bg-secondary/60">
                {item.faces && item.faces.length > 0 && <Faces faces={item.faces} size="md" />}
                <span className="min-w-0 flex-1">
                  <span className="block text-[17px] font-semibold">{item.label}</span>
                  <span className="block truncate text-[15px] text-muted-foreground">{item.potTitle} · {item.hint}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground lg:hidden" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * The ways to begin a pot. When nothing needs the viewer, "Start a pot" is the screen's one coral action;
 * otherwise it is a quiet row and the glass "+" in the header carries New pot. The booking preset is always a row.
 */
export function StartTiles({ primary = true }: { primary?: boolean }) {
  return (
    <section aria-label="Start a pot" className="space-y-3">
      {primary ? (
        <>
          <Link href="/new" className={linkButton({ size: 'lg', className: 'w-full md:w-auto md:border md:border-input md:bg-card md:text-foreground md:hover:bg-secondary' })}>Start a pot</Link>
          <p className="px-1 text-[15px] text-muted-foreground">Collect equal shares from a group.</p>
        </>
      ) : null}
      <ul className="divide-y divide-border rounded-group bg-card">
        {!primary && (
          <li>
            <Link href="/new" className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary/60">
              <span>
                <span className="block text-[17px] font-semibold">Start a pot</span>
                <span className="block text-[15px] text-muted-foreground">Collect equal shares from a group.</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        )}
        <li>
          <Link href="/new?preset=booking" className="flex min-h-[56px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary/60">
            <span>
              <span className="flex items-center gap-2 text-[17px] font-semibold"><CalendarClock className="size-4 text-muted-foreground" aria-hidden />Plan a real booking</span>
              <span className="block text-[15px] text-muted-foreground">48-hour objection window, 7-day request window.</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          </Link>
        </li>
      </ul>
    </section>
  );
}

/** Marker colour is decoration only: each row also says what happened. */
const MARKER: Record<ActivityItem['tone'], string> = {
  neutral: 'bg-input', money: 'bg-pine', warn: 'bg-warning', bad: 'bg-destructive',
};

/** Recent contract events in the viewer's pots, newest first. Events carry no timestamp, so order is the only time cue. */
export function ActivityFeed({ items }: { items: ActivityItem[] }) {
  return (
    <section id="activity" aria-labelledby="activity-heading" className="space-y-3">
      <h2 id="activity-heading" className="text-[22px] font-semibold">Activity</h2>
      {items.length === 0 ? (
        <p className="rounded-group bg-card p-4 text-[15px] text-muted-foreground">Payments and payouts in your pots show up here.</p>
      ) : (
        <ol className="divide-y divide-border rounded-group bg-card">
          {items.map(item => (
            <li key={item.id}>
              <Link href={`/pots/${item.potId}`} className="flex gap-3 px-4 py-3 text-[15px] transition-colors hover:bg-secondary/60">
                <span aria-hidden className={cn('mt-2 size-2 shrink-0 rounded-full', MARKER[item.tone])} />
                <span className="min-w-0">
                  <span className="block">{item.text}</span>
                  <span className="block truncate text-[13px] text-muted-foreground">{item.potTitle}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
