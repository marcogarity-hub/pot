import { Suspense } from 'react';
import Link from 'next/link';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { linkButton } from '@/components/pot/linkButton';
import { Screen } from '@/components/pot/Screen';
import { PotMark } from '@/components/pot/PotMark';
import { DashboardView } from '@/components/pot/DashboardView';
import {
  DASHBOARD_POT_COLUMNS, activityItems, needsYou,
  type ActivityEvent, type DashboardPot,
} from '@/components/pot/dashboardModel';

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
    return <Screen width="wide" nav={<Link href="/sign-in" className={linkButton({ size: 'sm', variant: 'outline' })}>Sign in</Link>}><SignedOut /></Screen>;
  }

  const [{ data: potRows }, { data: me }, { data: eventRows }] = await Promise.all([
    supabase.from('pot_status').select(DASHBOARD_POT_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('users').select('wallet_address').eq('auth_user_id', user.id).maybeSingle(),
    supabase.from('pot_events').select('id,pot_id::text,event_name,args').order('id', { ascending: false }).limit(40),
  ]);
  const pots = (potRows ?? []) as unknown as DashboardPot[];
  const myAddress = (me as { wallet_address: string | null } | null)?.wallet_address ?? null;

  const titles: Record<string, string> = {};
  const emails: Record<string, string> = {};
  for (const p of pots) {
    titles[p.pot_id] = p.title ?? `Pot #${p.pot_id}`;
    for (const m of p.members) if (m.email) emails[m.address.toLowerCase()] = m.email;
  }
  const queue = needsYou(pots, myAddress, requestTime());
  const activity = activityItems((eventRows ?? []) as unknown as ActivityEvent[], titles, myAddress, 12, emails);

  return <DashboardView email={user.email} pots={pots} queue={queue} activity={activity} />;
}

const GUARANTEES = [
  ['Nobody is paid early.', 'The organizer can only request the money after everyone has paid.'],
  ['Members can object.', 'Enough objections during the window freeze the payout.'],
  ['Refund if it does not fill.', 'Miss the deadline and everyone who paid takes their share back.'],
];

const STEPS = [
  { paid: 0, title: 'The organizer creates the pot', body: 'Set the total and invite the members by email.' },
  { paid: 2, title: 'Everyone pays their share', body: 'Each member pays an equal share in USDC. Progress updates live.' },
  { paid: 4, title: 'The pot locks', body: 'It locks only when every member has paid by the deadline.' },
  { paid: 4, title: 'The money moves', body: 'The organizer requests the payout and members get a window to object.' },
];

function SignedOut() {
  return (
    <div className="space-y-8">
    <div className="grid grid-cols-1 gap-px border border-border bg-border md:grid-cols-12">
      <div className="tick space-y-8 bg-card p-6 md:col-span-7 md:p-10">
        <h1 className="font-heading text-4xl font-semibold leading-[1.02] tracking-tight md:text-6xl">
          Nobody is in until their money is locked in.
        </h1>
        <p className="max-w-[52ch] text-base text-muted-foreground md:text-lg">
          Pot collects an equal share from everyone in USDC and holds it in a smart contract. The pot locks only when every member has paid.
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/sign-in?next=/new" className={linkButton({ size: 'lg' })}>Start a pot</Link>
          <Link href="/sign-in" className={linkButton({ size: 'lg', variant: 'outline' })}>Sign in</Link>
        </div>
      </div>
      <div className="flex flex-col justify-between gap-8 bg-card p-6 md:col-span-5 md:p-10">
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Example pot</p>
          <div className="grid grid-cols-4 gap-2" role="img" aria-label="Three of four seats paid">
            {[true, true, true, false].map((paid, i) => (
              <span key={i} aria-hidden className={paid ? 'aspect-square bg-primary' : 'aspect-square border-2 border-input bg-card'} />
            ))}
          </div>
          <p className="money text-sm">3 of 4 paid <span className="text-muted-foreground">· waiting on one more share</span></p>
        </div>
        <ul className="divide-y divide-border border-y border-border">
          {GUARANTEES.map(([head, body]) => (
            <li key={head} className="flex gap-3 py-3">
              <PotMark className="mt-0.5 size-5 shrink-0" />
              <p className="text-sm"><span className="font-semibold">{head}</span> <span className="text-muted-foreground">{body}</span></p>
            </li>
          ))}
        </ul>
      </div>
    </div>
    <section aria-labelledby="how" className="space-y-3">
      <h2 id="how" className="text-lg font-semibold">How a pot works</h2>
      <ol className="grid grid-cols-1 border border-border bg-card md:grid-cols-4 md:divide-x md:divide-border">
        {STEPS.map((step, i) => (
          <li key={step.title} className="relative space-y-3 border-b border-border p-5 last:border-b-0 md:border-b-0">
            <span className="flex items-center gap-1.5" aria-hidden>
              {[0, 1, 2, 3].map(n => <span key={n} className={n < step.paid ? 'size-4 bg-primary' : 'size-4 border border-input bg-card'} />)}
              <span className="money ml-auto text-xs text-muted-foreground">{i + 1} / {STEPS.length}</span>
            </span>
            <h3 className="font-semibold">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
    </div>
  );
}
