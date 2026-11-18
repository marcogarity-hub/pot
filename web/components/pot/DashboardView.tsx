import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from 'cn';
import { linkButton } from './linkButton';
import { DisplayNameForm } from './DisplayNameForm';
import { PotList } from './PotList';
import { Screen } from './Screen';
import { SignOutButton } from './SignOutButton';
import { FaceDot, type Face } from './Faces';
import { TabBar } from './TabBar';
import { ActivityFeed, HeldSummary, NeedsYou, StartTiles } from './DashboardParts';
import { heldAmount, stateCounts, type ActivityItem, type DashboardPot, type QueueItem } from './dashboardModel';

/** Right-hand column on desktop; full width on the phone, where the DOM order is the visual order. */
const SIDE = 'min-w-0 md:col-span-5 md:col-start-8';

/**
 * The signed-in home. Pure view over already-loaded data, so a fixture can render it too.
 * Phone: one column (needs you, start, trips, activity, you). Desktop: trips on the left, the rest on the right.
 */
export function DashboardView({ email, name, pots, queue, activity }: {
  email: string; name: string | null; pots: DashboardPot[]; queue: QueueItem[]; activity: ActivityItem[];
}) {
  const needingTrips = new Set(queue.map(q => q.potId)).size;
  const subtitle = needingTrips === 0
    ? 'All caught up for now.'
    : `${needingTrips} ${needingTrips === 1 ? 'trip needs' : 'trips need'} you`;
  const avatar: Face = { seat: 1, name, email, paid: true };

  return (
    <Screen
      width="wide"
      title={name ? `Hey ${name}` : 'Hey there'}
      nav={
        <>
          <Link href="/new" aria-label="New pot" className={linkButton({ variant: 'glass', size: 'icon' })}>
            <Plus className="size-5" strokeWidth={2} aria-hidden />
          </Link>
          <Link href="#you" aria-label="You" className={linkButton({ variant: 'glass', size: 'icon' })}>
            <FaceDot face={avatar} size="sm" />
          </Link>
        </>
      }
    >
      <div className="space-y-8">
        <p className="-mt-4 text-[17px] text-muted-foreground">{subtitle}</p>
        <div className="flex flex-col gap-8 md:grid md:grid-cols-12 md:items-start">
          {name === null && (
            <p className={cn(SIDE, 'rounded-group bg-card px-4 py-3 text-[15px]')}>
              Other members can&apos;t tell who you are yet.{' '}
              <a href="#your-name" className="font-semibold text-foreground underline underline-offset-4">Add your name</a>
            </p>
          )}
          <div className={SIDE}>
            <NeedsYou items={queue} />
          </div>
          <div className={cn(SIDE, 'space-y-8')}>
            <StartTiles primary={queue.length === 0} />
            <HeldSummary held={heldAmount(pots)} potCount={pots.length} needsCount={queue.length} counts={stateCounts(pots)} />
          </div>
          <section aria-labelledby="your-trips" className="min-w-0 space-y-3 md:col-span-7 md:col-start-1 md:row-span-full md:row-start-1">
            <h2 id="your-trips" className="text-[22px] font-semibold">Your trips</h2>
            <PotList pots={pots} />
          </section>
          <div className={cn(SIDE, 'space-y-8')}>
            <ActivityFeed items={activity} />
          </div>
          <section id="you" aria-labelledby="you-heading" className={cn(SIDE, 'space-y-3')}>
            <h2 id="you-heading" className="text-[22px] font-semibold">You</h2>
            <div className="space-y-4 rounded-group bg-card p-4">
              <p className="text-[15px] text-muted-foreground">Signed in as <span className="break-all text-foreground">{email}</span></p>
              <div id="your-name">
                <DisplayNameForm initialName={name} />
              </div>
              <SignOutButton />
            </div>
          </section>
        </div>
      </div>
      <TabBar />
    </Screen>
  );
}
