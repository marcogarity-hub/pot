import Link from 'next/link';
import { History } from './History';
import { NameBanner } from './NameBanner';
import { DashboardStrip } from './DashboardStrip';
import { NeedsYouCards } from './DashboardParts';
import { PotList } from './PotList';
import { QuickStart } from './QuickStart';
import { ClosingSoon } from './ClosingSoon';
import { TripCover } from './TripCover';
import { closingSoon, firstName, heldAmount, heldPotCount, type DashboardPot, type QueueItem } from './dashboardModel';

/**
 * The signed-in home, content only: AppShell draws the sidebar and the phone tab bar around it.
 * Pure view over already-loaded data, so a fixture can render it too. `now` is the render's clock, passed in.
 * Phone: greeting, name banner, strip, needs you, your trips, quick start, history, closing soon.
 * lg and up: needs you, your trips and quick start in the main column, with history and closing soon on the right.
 */
export function DashboardView({ name, pots, queue, now }: {
  name: string | null; pots: DashboardPot[]; queue: QueueItem[]; now: number;
}) {
  const needing = new Set(queue.map(q => q.potId)).size;
  const subtitle = needing === 0
    ? 'Nothing needs you right now'
    : `${needing} ${needing === 1 ? 'needs' : 'need'} you`;
  const first = firstName(name);
  const closing = closingSoon(pots, now);

  return (
    <main className="relative min-h-dvh">
      {/* Cover art behind the greeting on md and up. The mask fades it out so the text stays readable. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-[400px] overflow-hidden md:block [mask-image:linear-gradient(to_bottom,black_18%,transparent_72%)]">
        <TripCover potId="dashboard" className="h-full" />
      </div>

      <div className="relative mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-10 md:pb-16 md:pt-12">
        <div className="space-y-2">
          <h1 className="font-heading text-[34px] leading-[1.05] md:text-[56px]">{first ? `Hey ${first}` : 'Hey there'}</h1>
          <p className="text-[17px] text-muted-foreground">{subtitle}</p>
        </div>

        <div className="mt-6 space-y-4">
          {first === null && <NameBanner />}
          <DashboardStrip held={heldAmount(pots)} heldPots={heldPotCount(pots)} primary={pots.length === 0} />
        </div>

        {/* Phones: needs you, your pots, quick start, then the side widgets. lg: needs you beside History and Closing soon,
            then the pots and quick start across the full width, so the trip cards get room for their titles. */}
        <div className="mt-10 flex flex-col gap-10 lg:grid lg:grid-cols-12 lg:items-start lg:gap-x-8 lg:gap-y-10">
          <div className="order-1 min-w-0 lg:col-span-7 lg:col-start-1 lg:row-start-1">
            <NeedsYouCards items={queue} />
          </div>
          <div className="order-4 min-w-0 space-y-10 lg:col-span-5 lg:col-start-8 lg:row-start-1">
            <History />
            <ClosingSoon pots={closing} now={now} />
          </div>
          <section id="your-pots" aria-labelledby="your-pots-heading" className="order-2 min-w-0 space-y-3 lg:col-span-12 lg:row-start-2">
            <h2 id="your-pots-heading" className="text-[22px] font-semibold">Your trips</h2>
            <PotList pots={pots} />
          </section>
          <div className="order-3 min-w-0 lg:col-span-12 lg:row-start-3">
            <QuickStart />
          </div>
        </div>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
          <span>Test money only: USDC on the Arc testnet.</span>
          <Link href="/privacy" className="underline">Privacy</Link>
        </footer>
      </div>
    </main>
  );
}
