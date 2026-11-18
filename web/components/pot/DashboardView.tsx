import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from 'cn';
import { linkButton } from './linkButton';
import { DisplayNameForm } from './DisplayNameForm';
import { PotList } from './PotList';
import { PotMark } from './PotMark';
import { SignOutButton } from './SignOutButton';
import { FaceDot, type Face } from './Faces';
import { TabBar } from './TabBar';
import { TripCover } from './TripCover';
import { SideNav } from './SideNav';
import { ActivityFeed, HeldSummary, NeedsYou, StartTiles } from './DashboardParts';
import { heldAmount, stateCounts, type ActivityItem, type DashboardPot, type QueueItem } from './dashboardModel';

/** Desktop: the content sits right of the sidebar (232px plus 16px gutters). Phone keeps one column. */
const MAIN = 'mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:ml-[264px] md:w-auto md:max-w-none md:px-10 md:pb-16 md:pt-[200px]';
/** Right-hand column on desktop. */
const RIGHT = 'min-w-0 md:col-span-5 md:col-start-8';
/** Left-hand column on desktop; spans the two rows that the right-hand column fills. */
const LEFT = 'min-w-0 md:col-span-7 md:col-start-1 md:row-span-2';

/**
 * The signed-in home. Pure view over already-loaded data, so a fixture can render it too.
 * Phone: one column (needs you, start, trips, activity, you) under the header and TabBar.
 * Desktop: a glass sidebar, the greeting over cover art, needs you and trips full width, then activity on the
 * left with money, start and you on the right.
 */
export function DashboardView({ email, name, pots, queue, activity }: {
  email: string; name: string | null; pots: DashboardPot[]; queue: QueueItem[]; activity: ActivityItem[];
}) {
  const needingTrips = new Set(queue.map(q => q.potId)).size;
  const subtitle = needingTrips === 0
    ? 'All caught up for now.'
    : `${needingTrips} ${needingTrips === 1 ? 'trip needs' : 'trips need'} you`;
  const avatar: Face = { seat: 1, name, email, paid: true };
  const sidePots = pots.map(p => ({ id: p.pot_id, title: p.title ?? `Pot #${p.pot_id}` }));

  return (
    <div className="relative min-h-dvh">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden h-[400px] overflow-hidden md:block [mask-image:linear-gradient(to_bottom,black_35%,transparent)]">
        <TripCover potId="dashboard" className="h-full" />
      </div>
      <SideNav pots={sidePots} name={name} email={email} />

      <header className="pt-safe md:hidden">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
            <PotMark />
            Pot
          </Link>
          <nav aria-label="Account" className="flex min-w-0 items-center gap-2 text-[15px]">
            <Link href="/new" aria-label="New pot" className={linkButton({ variant: 'glass', size: 'icon' })}>
              <Plus className="size-5" strokeWidth={2} aria-hidden />
            </Link>
            <Link href="#you" aria-label="You" className={linkButton({ variant: 'glass', size: 'icon' })}>
              <FaceDot face={avatar} size="sm" />
            </Link>
          </nav>
        </div>
      </header>

      <main className={MAIN}>
        <h1 className="mb-6 font-heading text-[34px] leading-[1.05] md:text-[56px]">{name ? `Hey ${name}` : 'Hey there'}</h1>
        <div className="space-y-8">
          <p className="-mt-4 text-[17px] text-muted-foreground">{subtitle}</p>
          {name === null && (
            <p className="rounded-group bg-card px-4 py-3 text-[15px]">
              Other members can&apos;t tell who you are yet.{' '}
              <a href="#your-name" className="font-semibold text-foreground underline underline-offset-4">Add your name</a>
            </p>
          )}
          <div className="flex flex-col gap-8 md:grid md:grid-cols-12 md:items-start">
            <div className="min-w-0 md:col-span-12">
              <NeedsYou items={queue} />
            </div>
            <section aria-labelledby="your-trips" className="min-w-0 space-y-3 md:col-span-12">
              <h2 id="your-trips" className="text-[22px] font-semibold">Your trips</h2>
              <PotList pots={pots} />
            </section>
            <div className={cn(RIGHT, 'space-y-8')}>
              <StartTiles primary={queue.length === 0} />
              <HeldSummary held={heldAmount(pots)} potCount={pots.length} needsCount={queue.length} counts={stateCounts(pots)} />
            </div>
            <div className={cn(LEFT, 'space-y-8')}>
              <ActivityFeed items={activity} />
            </div>
            <section id="you" aria-labelledby="you-heading" className={cn(RIGHT, 'space-y-3')}>
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
      </main>

      <footer className="pb-safe md:ml-[264px]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 pb-24 pt-2 text-[13px] text-muted-foreground md:max-w-none md:px-10 md:pb-6">
          <span>Test money only: USDC on the Arc testnet.</span>
          <Link href="/privacy" className="underline">Privacy</Link>
        </div>
      </footer>
      <TabBar />
    </div>
  );
}
