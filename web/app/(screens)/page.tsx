import { Suspense } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { createServerSupabase } from '@/lib/supabase/server';
import { linkButton } from '@/components/pot/linkButton';
import { PotList, type PotSummary } from '@/components/pot/PotList';
import { Screen } from '@/components/pot/Screen';
import { SignOutButton } from '@/components/pot/SignOutButton';

export default function Home() {
  return (
    <Screen>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading…</p>}>
        <HomeContent />
      </Suspense>
    </Screen>
  );
}

// Reads the session cookie, so it streams in behind the Suspense boundary.
async function HomeContent() {
  const supabase = await createServerSupabase();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return <SignedOut />;

  const { data: rows } = await supabase
    .from('pot_status')
    .select('pot_id::text,title,state,total::text,share::text,is_organizer,members')
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Your pots</h1>
        <Link href="/new" className={linkButton({ size: 'sm' })}><Plus /> New pot</Link>
      </div>
      <PotList pots={(rows ?? []) as unknown as PotSummary[]} />
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="truncate">{data.user.email}</span>
        <SignOutButton />
      </div>
    </div>
  );
}

function SignedOut() {
  return (
    <div className="space-y-6 py-8">
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">Chip in together. Nobody is in until their money is locked in.</h1>
        <p className="text-muted-foreground">
          Pot collects an equal share from everyone in USDC. The money stays locked until the organizer asks for it,
          and members can object before it&apos;s released. If the pot doesn&apos;t fill by the deadline, everyone gets their money back.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Link href="/sign-in?next=/new" className={linkButton({ size: 'lg' })}>Start a pot</Link>
        <Link href="/sign-in" className={linkButton({ size: 'lg', variant: 'outline' })}>Sign in</Link>
      </div>
    </div>
  );
}
