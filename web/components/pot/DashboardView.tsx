import Link from 'next/link';
import { History } from './History';
import { NameBanner } from './NameBanner';
import { DashboardStrip } from './DashboardStrip';
import { NeedsYouCards, historyPlacement } from './DashboardParts';
import { PotList } from './PotList';
import { QuickStart } from './QuickStart';
import { ClosingSoon } from './ClosingSoon';
import { TripCover } from './TripCover';
import { closingSoon, firstName, groupNeeds, heldAmount, heldPotCount, type DashboardPot, type QueueItem } from './dashboardModel';

/**
 * The signed-in home, content only: AppShell draws the sidebar and the phone tab bar around it.
 * Pure view over already-loaded data, so a fixture can render it too. `now` is the render's clock, passed in.
 * Phone: greeting, name banner (until a name is set), strip, needs you, your plans, start something new, closing soon, history.
 * lg and up: a 50/50 split in one four-column grid. Needs you (two cards per row, an odd one spanning the left half) and
 * closing soon share the top row; history sits under closing soon, aligned with the bottom needs-you card. Plans and
 * start something new follow across the full width.
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
  const needCount = groupNeeds(queue).length;

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
          <DashboardStrip held={heldAmount(pots)} heldPlans={heldPotCount(pots)} />
        </div>

        <div className="mt-10 flex flex-col gap-10">
          {/* One shared grid on lg, so every box on a row has the same top and bottom edges. Phones stack these in order. */}
          <div className="contents lg:grid lg:grid-cols-4 lg:items-stretch lg:gap-x-6 lg:gap-y-3">
            <NeedsYouCards items={queue} className="order-1" />
            <ClosingSoon pots={closing} now={now} className="order-4" />
            <History surface="tint-sage" className={historyPlacement(needCount)} />
          </div>
          <section id="your-pots" aria-labelledby="your-pots-heading" className="order-2 min-w-0 space-y-3">
            <h2 id="your-pots-heading" className="text-[22px] font-semibold">Your plans</h2>
            <PotList pots={pots} />
          </section>
          <div className="order-3 min-w-0">
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
