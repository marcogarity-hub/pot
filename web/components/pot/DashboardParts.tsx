import Link from 'next/link';
import { cn } from 'cn';
import { Faces } from './Faces';
import { groupNeeds, type NeedGroup, type QueueItem } from './dashboardModel';

/** Visible focus for the card links: the ring is drawn by the outline, not by colour alone. */
const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** The plain sentence for a card that covers several pots. Keyed by action, so the wording never mixes types. */
const SEVERAL: Record<QueueItem['action'], (n: number) => string> = {
  pay: n => `Pay your share in ${n} trips`,
  'request-payout': n => `Request the payout for ${n} trips`,
  'review-payout': n => `Review the payout in ${n} trips`,
  finalize: n => `Finalize the payout in ${n} trips`,
  refund: n => `Claim your refund from ${n} trips`,
};

/** One widget card per action type. A single pot links straight to it; several link to the trips list. */
function NeedCard({ group }: { group: NeedGroup }) {
  const { action, items, soonest } = group;
  const count = items.length;
  const many = count > 1;
  const faces = soonest.faces ?? [];
  return (
    <Link
      href={many ? '#your-pots' : items[0].href}
      className={cn('flex min-h-[64px] flex-col gap-3 rounded-group bg-card p-5 transition-colors hover:bg-secondary/60', FOCUS)}
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
 */
export function NeedsYouCards({ items }: { items: QueueItem[] }) {
  const groups = groupNeeds(items);
  return (
    <section aria-labelledby="needs-you" className="space-y-3">
      <h2 id="needs-you" className="text-[22px] font-semibold">Needs you</h2>
      {groups.length === 0 ? (
        <p className="rounded-group bg-card p-5 text-[15px] text-muted-foreground">Nothing needs you right now.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {groups.map(group => (
            <li key={group.action} className="last:odd:sm:col-span-2">
              <NeedCard group={group} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
