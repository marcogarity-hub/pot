import { AppLink } from '@/components/pot/demo/DemoContext';
import { cn } from 'cn';
import { formatDollars } from '@/lib/format/money';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** One equal-width segment of the strip. Plain white, never coral: the sidebar's New plan is the one coral action. */
const SEGMENT = 'flex min-h-[64px] items-center rounded-group bg-card px-5 py-3 text-[17px] font-semibold transition-colors hover:bg-secondary/60';

/**
 * The slim strip under the greeting: two ways to start, and the money held. The three segments split the full width
 * of the banner above; on phones they stack. With nothing held, the two starts share the width.
 */
export function DashboardStrip({ held, heldPlans }: { held: bigint; heldPlans: number }) {
  const hasHeld = held > BigInt(0);
  return (
    <div className={cn('grid gap-3 sm:grid-cols-2', hasHeld && 'sm:grid-cols-3')}>
      <AppLink href="/new" className={cn(SEGMENT, FOCUS)}>Start a plan</AppLink>
      <AppLink href="/new?preset=booking" className={cn(SEGMENT, FOCUS)}>Plan a real booking</AppLink>
      {hasHeld && (
        <p className="money flex min-h-[64px] items-center rounded-group bg-card px-5 py-3 text-[15px] text-muted-foreground">
          <span><span className="font-semibold text-foreground">{formatDollars(held)}</span> held across {heldPlans} {heldPlans === 1 ? 'plan' : 'plans'}</span>
        </p>
      )}
    </div>
  );
}
