import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Screen } from '@/components/pot/Screen';
import { DemoFrame } from '@/components/pot/demo/DemoFrame';
import { DemoPot } from '@/components/pot/demo/DemoPot';
import { demoAtRequest, findDemoPlan } from '@/lib/demo/data';

// A demo plan. The page is full-bleed (cover art under floating glass) and floats its own action bar, so no phone tab bar.
export default function DemoPotPage({ params }: PageProps<'/demo/pots/[potId]'>) {
  return (
    <Screen flush>
      <Suspense fallback={<p className="px-4 py-6 text-[15px] text-muted-foreground">Loading plan…</p>}>
        {params.then(({ potId }) => <DemoPotContent potId={potId} />)}
      </Suspense>
    </Screen>
  );
}

async function DemoPotContent({ potId }: { potId: string }) {
  await connection();
  const demo = demoAtRequest();
  const status = findDemoPlan(demo, potId);
  if (!status) notFound();
  return (
    <DemoFrame history={demo.history} hideTabBar>
      <DemoPot status={status} />
    </DemoFrame>
  );
}
