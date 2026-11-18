import { AppLink } from '@/components/pot/demo/DemoContext';
import { cn } from 'cn';
import { formatDuration, type ClosingPot } from './dashboardModel';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * Plans still collecting money that close within a week: title, how many have paid, and the time left. A calm
 * empty card when none. On lg the heading and card sit in DashboardView's shared grid, right half, top row.
 */
export function ClosingSoon({ pots, now, className }: { pots: ClosingPot[]; now: number; className?: string }) {
  return (
    <section aria-labelledby="closing-soon" className={cn('space-y-3 lg:contents lg:space-y-0', className)}>
      <h2 id="closing-soon" className="text-[22px] font-semibold lg:col-span-2 lg:col-start-3 lg:row-start-1">Closing soon</h2>
      {pots.length === 0 ? (
        <p className="flex min-h-[64px] items-center rounded-group tint-sky p-5 text-[15px] text-muted-foreground lg:col-span-2 lg:col-start-3 lg:row-start-2">
          Nothing closes in the next week.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-group tint-sky lg:col-span-2 lg:col-start-3 lg:row-start-2">
          {pots.map(p => (
            <li key={p.potId}>
              <AppLink href={`/pots/${p.potId}`} className={`flex min-h-[64px] items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-secondary/60 ${FOCUS}`}>
                <span className="min-w-0">
                  <span className="block truncate text-[17px] font-semibold">{p.title}</span>
                  <span className="block text-[15px] text-muted-foreground">{p.paid} of {p.members} paid</span>
                </span>
                <span className="shrink-0 text-right text-[15px] font-semibold">Closes in {formatDuration(p.deadlineAt - now)}</span>
              </AppLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
