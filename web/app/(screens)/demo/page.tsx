import { Suspense } from 'react';
import { connection } from 'next/server';
import { Screen } from '@/components/pot/Screen';
import { DashboardView } from '@/components/pot/DashboardView';
import { DemoFrame } from '@/components/pot/demo/DemoFrame';
import { needsYou } from '@/components/pot/dashboardModel';
import { DEMO_ME, DEMO_WALLET, demoAtRequest } from '@/lib/demo/data';

/** The demo dashboard. Sample data placed relative to the request time, so deadlines are always live. */
export default function DemoHome() {
  return (
    <Suspense fallback={<Screen width="wide"><p className="text-sm text-muted-foreground">Loading…</p></Screen>}>
      <DemoHomeContent />
    </Suspense>
  );
}

async function DemoHomeContent() {
  await connection();
  const demo = demoAtRequest();
  const queue = needsYou(demo.pots, DEMO_WALLET, demo.now);
  return (
    <DemoFrame history={demo.history}>
      <DashboardView name={DEMO_ME.name} pots={demo.pots} queue={queue} now={demo.now} />
    </DemoFrame>
  );
}
