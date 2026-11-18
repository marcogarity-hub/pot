import Link from 'next/link';
import { cn } from 'cn';
import { Faces } from './Faces';
import { groupNeeds, type NeedGroup, type QueueItem } from './dashboardModel';

/** Visible focus for the card links: the ring is drawn by the outline, not by colour alone. */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** The plain sentence for a card that covers several plans. Keyed by action, so the wording never mixes types. */
const SEVERAL: Record<QueueItem['action'], (n: number) => string> = {
  pay: n => `Pay your share in ${n} plans`,
  'request-payout': n => `Request the payout for ${n} plans`,
  'review-payout': n => `Review the payout in ${n} plans`,
  finalize: n => `Finalize the payout in ${n} plans`,
  refund: n => `Claim your refund from ${n} plans`,
};

/** A soft tint per action type. Each widget gets its own colour; refund reuses sage, the last one left. */
const TINT: Record<QueueItem['action'], string> = {
  pay: 'tint-peach',
  'review-payout': 'tint-lavender',
  'request-payout': 'tint-butter',
  finalize: 'tint-rose',
  refund: 'tint-sage',
};

/** Lg grid rows: row 1 holds the headings, the needs-you cards start at row 2, two per row. */
const ROW_START: Record<number, string> = {
  2: 'lg:row-start-2', 3: 'lg:row-start-3', 4: 'lg:row-start-4', 5: 'lg:row-start-5',
};

/**
 * The last lg row the needs-you cards reach. Never above row 3, so History (and the bottom card) always line up
 * with the row below Closing soon.
 */
function needsLastRow(count: number): number {
  return Math.max(3, 1 + Math.ceil(count / 2));
}

/**
 * Where a needs-you card sits in the lg grid (four columns; the left half is columns 1-2). Two cards per row. An
 * odd last card spans the left half. One card, or none, fills the left half across rows 2-3 so the column stays balanced.
 */
function needSlot(index: number, count: number): string {
  if (count <= 1) return 'lg:col-span-2 lg:col-start-1 lg:row-start-2 lg:row-span-2';
  const row = ROW_START[2 + Math.floor(index / 2)];
  if (index === count - 1 && index % 2 === 0) return cn(row, 'lg:col-span-2 lg:col-start-1');
  return cn(row, index % 2 === 0 ? 'lg:col-start-1' : 'lg:col-start-2');
}

/** Placement and order for the History widget: right half, aligned with the bottom needs-you card, last on phones. */
export function historyPlacement(count: number): string {
  return cn('order-5 min-w-0 lg:col-span-2 lg:col-start-3', ROW_START[needsLastRow(count)]);
}

/** One widget card per action type. A single plan links straight to it; several link to the plans list. */
function NeedCard({ group, className }: { group: NeedGroup; className: string }) {
  const { action, items, soonest } = group;
  const count = items.length;
  const many = count > 1;
  const faces = soonest.faces ?? [];
  return (
    <Link
      href={many ? '#your-pots' : items[0].href}
      className={cn('flex min-h-[64px] flex-col gap-3 rounded-group p-5 transition-[filter] hover:brightness-[0.97]', TINT[action], FOCUS, className)}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block text-[17px] font-semibold">
            {many ? SEVERAL[action](count) : items[0].label}
          </span>
          <span className="block text-[15px] text-muted-foreground">
            {many ? `Soonest: ${soonest.potTitle}, ${soonest.hint}` : `${items[0].potTitle} · ${items[0].hint}`}
          </span>
        </span>
        {many && <span aria-hidden className="money shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-[15px] font-semibold">{count}</span>}
      </span>
      {faces.length > 0 && <Faces faces={faces} size="sm" max={6} />}
    </Link>
  );
}

/**
 * "Needs you" as widget cards, one per action type, most urgent first. Empty state when nothing is waiting.
 * On lg the section and its list are display:contents, so the heading and cards sit in DashboardView's shared grid.
 */
export function NeedsYouCards({ items, className }: { items: QueueItem[]; className?: string }) {
  const groups = groupNeeds(items);
  const count = groups.length;
  return (
    <section aria-labelledby="needs-you" className={cn('space-y-3 lg:contents lg:space-y-0', className)}>
      <h2 id="needs-you" className="text-[22px] font-semibold lg:col-span-2 lg:col-start-1 lg:row-start-1">Needs you</h2>
      {count === 0 ? (
        <p className={cn('flex min-h-[64px] items-center rounded-group tint-peach p-5 text-[15px]', needSlot(0, 0))}>
          Nothing needs you right now.
        </p>
      ) : (
        <ul role="list" className="grid gap-3 sm:grid-cols-2 lg:contents">
          {groups.map((group, i) => (
            <li key={group.action} role="listitem" className="last:odd:sm:col-span-2 lg:contents">
              <NeedCard group={group} className={needSlot(i, count)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
