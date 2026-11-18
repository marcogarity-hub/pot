import Link from 'next/link';
import { formatDollars } from '@/lib/format/money';
import { linkButton } from './linkButton';

/**
 * The slim strip under the greeting: two ways to start, and the money held. Only "Start a pot" can be coral, and
 * only on a phone when the person has no pots at all. Desktop keeps the sidebar's New pot as the one coral action.
 */
export function DashboardStrip({ held, heldPots, primary }: { held: bigint; heldPots: number; primary: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/new"
        className={linkButton({
          variant: primary ? 'default' : 'outline',
          className: primary ? 'md:border md:border-input md:bg-card md:text-foreground md:hover:bg-secondary' : undefined,
        })}
      >
        Start a pot
      </Link>
      <Link href="/new?preset=booking" className={linkButton({ variant: 'outline' })}>Plan a real booking</Link>
      {held > BigInt(0) && (
        <p className="money text-[15px] text-muted-foreground">
          <span className="font-semibold text-foreground">{formatDollars(held)}</span> held across {heldPots} {heldPots === 1 ? 'pot' : 'pots'}
        </p>
      )}
    </div>
  );
}
