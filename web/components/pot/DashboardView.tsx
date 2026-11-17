import Link from 'next/link';
import { Plus } from 'lucide-react';
import { linkButton } from './linkButton';
import { DisplayNameForm } from './DisplayNameForm';
import { PotList } from './PotList';
import { Screen } from './Screen';
import { SignOutButton } from './SignOutButton';
import { ActivityFeed, HeldSummary, NeedsYou, StartTiles } from './DashboardParts';
import { heldAmount, stateCounts, type ActivityItem, type DashboardPot, type QueueItem } from './dashboardModel';

/** The signed-in home. Pure view over already-loaded data, so a fixture can render it too. */
export function DashboardView({ email, name, pots, queue, activity }: {
  email: string; name: string | null; pots: DashboardPot[]; queue: QueueItem[]; activity: ActivityItem[];
}) {
  return (
    <Screen
      width="wide"
      nav={
        <>
          <span className="hidden max-w-[16rem] truncate text-muted-foreground sm:inline">{name ?? email}</span>
          <SignOutButton />
          <Link href="/new" className={linkButton({ size: 'sm' })}><Plus /> New pot</Link>
        </>
      }
    >
      <div className="space-y-8">
        {name === null && (
          <p className="border border-border bg-card px-4 py-3 text-sm">
            Other members can&apos;t tell who you are yet.{' '}
            <a href="#your-name" className="font-medium text-primary underline underline-offset-4">Add your name</a>
          </p>
        )}
        <div className="grid grid-cols-1 gap-px bg-border md:grid-cols-12">
          <div className="min-w-0 md:col-span-8"><HeldSummary held={heldAmount(pots)} potCount={pots.length} needsCount={queue.length} counts={stateCounts(pots)} /></div>
          <div className="min-w-0 md:col-span-4"><StartTiles primary={queue.length === 0} /></div>
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
          <div className="min-w-0 space-y-8 md:col-span-8">
            <NeedsYou items={queue} />
            <section aria-labelledby="your-pots" className="space-y-3">
              <h2 id="your-pots" className="text-lg font-semibold">Your pots</h2>
              <PotList pots={pots} />
            </section>
          </div>
          <aside className="min-w-0 space-y-8 md:col-span-4">
            <ActivityFeed items={activity} />
            <section id="your-name" className="border border-border bg-card p-4">
              <DisplayNameForm initialName={name} />
            </section>
          </aside>
        </div>
      </div>
    </Screen>
  );
}
