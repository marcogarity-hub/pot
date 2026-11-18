import { Suspense } from 'react';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { linkButton } from '@/components/pot/linkButton';
import { Screen } from '@/components/pot/Screen';
import { PotMark } from '@/components/pot/PotMark';
import { TripCover } from '@/components/pot/TripCover';
import { Faces, type Face } from '@/components/pot/Faces';
import { AppShell } from '@/components/pot/AppShell';
import { DashboardView } from '@/components/pot/DashboardView';
import { DASHBOARD_POT_COLUMNS, needsYou, type DashboardPot } from '@/components/pot/dashboardModel';

/** The server render's clock, read outside the component so the render itself stays pure. */
const requestTime = () => Date.now();

export default function Home() {
  return (
    <Suspense fallback={<Screen width="wide"><p className="text-sm text-muted-foreground">Loading…</p></Screen>}>
      <HomeContent />
    </Suspense>
  );
}

// Reads the session cookie, so it streams in behind the Suspense boundary.
async function HomeContent() {
  const supabase = await createServerSupabase();
  const user = await getVerifiedUser(supabase);
  if (!user) {
    return <Screen width="wide" nav={<Link href="/sign-in" className={linkButton({ variant: "glass" })}>Sign in</Link>}><SignedOut /></Screen>;
  }

  const [{ data: potRows }, { data: me }] = await Promise.all([
    supabase.from('pot_status').select(DASHBOARD_POT_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('users').select('wallet_address,display_name').eq('auth_user_id', user.id).maybeSingle(),
  ]);
  const pots = (potRows ?? []) as unknown as DashboardPot[];
  const myAddress = (me as { wallet_address: string | null } | null)?.wallet_address ?? null;
  const myName = (me as { display_name: string | null } | null)?.display_name ?? null;

  const now = requestTime();
  const queue = needsYou(pots, myAddress, now);

  return (
    <AppShell me={{ name: myName, email: user.email }}>
      <DashboardView name={myName} pots={pots} queue={queue} now={now} />
    </AppShell>
  );
}

const GUARANTEES = [
  ['Nobody is paid early.', 'The organizer can only request the money after everyone has paid.'],
  ['Members can object.', 'Enough objections during the window freeze the payout.'],
  ['Refund if it does not fill.', 'Miss the deadline and everyone who paid takes their share back.'],
];

/** The example pot on the signed-out home. Illustrative only: nothing here is read from the database. */
const EXAMPLE_FACES: Face[] = [
  { seat: 1, name: 'Maya', paid: true },
  { seat: 2, name: 'Jon', paid: true },
  { seat: 3, name: 'Priya', paid: true },
  { seat: 4, name: 'Theo', paid: false },
];

function SignedOut() {
  const paid = EXAMPLE_FACES.filter(f => f.paid).length;
  return (
    <div className="space-y-8 md:space-y-12">
      {/* Phone: cover, then the example card and copy stacked. Desktop: the cover is a wide panel with the copy and the example card on it. */}
      <section aria-label="Example plan" className="relative">
        <TripCover potId="home-example" className="h-64 rounded-group md:h-[30rem]" />
        <div className="relative -mt-14 mx-3 space-y-3 rounded-group bg-card p-5 md:absolute md:bottom-8 md:right-8 md:mx-0 md:mt-0 md:w-80">
          <p className="text-[17px] font-semibold">Cabin weekend</p>
          <Faces faces={EXAMPLE_FACES} />
          <p className="money text-[15px]">
            <span className="font-semibold">{paid} of {EXAMPLE_FACES.length} in</span>{' '}
            <span className="text-muted-foreground">· waiting on one more share</span>
          </p>
        </div>
        <div className="mt-8 space-y-5 px-1 md:absolute md:left-8 md:top-8 md:mt-0 md:w-[32rem] md:space-y-6 md:rounded-group md:bg-card md:p-8">
          <h1 className="font-heading text-[34px] leading-[1.05] md:text-[52px] md:leading-[1.02]">Nobody is in until their money is locked in.</h1>
          <p className="text-[17px] text-muted-foreground">
            Pot collects an equal share from everyone and holds it until the whole group has paid. The plan locks only when every member has paid.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-in" className={linkButton({ size: 'lg', className: 'w-full sm:w-auto' })}>Sign in</Link>
            <Link href="/sign-in?next=/new" className={linkButton({ size: 'lg', variant: 'outline', className: 'w-full sm:w-auto' })}>Start a plan</Link>
          </div>
        </div>
      </section>
      <ul className="divide-y divide-border rounded-group bg-card px-4 md:grid md:grid-cols-3 md:gap-6 md:divide-y-0 md:bg-transparent md:px-0">
        {GUARANTEES.map(([head, body]) => (
          <li key={head} className="flex gap-3 py-3 md:flex-col md:gap-4 md:rounded-group md:bg-card md:p-6">
            <PotMark className="mt-0.5 size-5 shrink-0" />
            <p className="text-[15px] md:text-[17px]"><span className="font-semibold">{head}</span> <span className="text-muted-foreground">{body}</span></p>
          </li>
        ))}
      </ul>
    </div>
  );
}
