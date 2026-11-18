import Link from 'next/link';
import { formatDuration, type ClosingPot } from './dashboardModel';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Pots still collecting money that close within a week: title, how many have paid, and the time left. Hidden when none. */
export function ClosingSoon({ pots, now }: { pots: ClosingPot[]; now: number }) {
  if (pots.length === 0) return null;
  return (
    <section aria-labelledby="closing-soon" className="space-y-3">
      <h2 id="closing-soon" className="text-[22px] font-semibold">Closing soon</h2>
      <ul className="divide-y divide-border rounded-group bg-card">
        {pots.map(p => (
          <li key={p.potId}>
            <Link href={`/pots/${p.potId}`} className={`flex min-h-[64px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary/60 ${FOCUS}`}>
              <span className="min-w-0">
                <span className="block truncate text-[17px] font-semibold">{p.title}</span>
                <span className="block text-[15px] text-muted-foreground">{p.paid} of {p.members} paid</span>
              </span>
              <span className="shrink-0 text-right text-[15px] font-semibold">Closes in {formatDuration(p.deadlineAt - now)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
