'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AppShell } from '../AppShell';
import { DemoProvider } from './DemoContext';
import { DEMO_ME, DEMO_WALLET, type DemoData } from '@/lib/demo/data';
import { linkButton } from '../linkButton';

/**
 * The signed-in frame for the public demo: the real sidebar and tab bar, fed Alex's sample account, with a strip
 * across the top that says this is sample data. Everything inside reads the demo through DemoProvider.
 * `hideTabBar` is for pages that float their own action bar (a plan).
 */
export function DemoFrame({ history, hideTabBar = false, children }: {
  history: DemoData['history']; hideTabBar?: boolean; children: ReactNode;
}) {
  return (
    <DemoProvider value={{ history, wallet: DEMO_WALLET, email: DEMO_ME.email }}>
      <AppShell me={{ name: DEMO_ME.name, email: DEMO_ME.email }} hideTabBar={hideTabBar}>
        <DemoBanner />
        {children}
      </AppShell>
    </DemoProvider>
  );
}

/** A quiet strip, in flow at the top of every demo page. Says what this is, and offers the real thing. */
function DemoBanner() {
  return (
    <div role="note" className="pt-safe bg-muted">
      <div className="mx-auto flex min-h-11 w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 text-[13px] md:px-10">
        <p><span className="font-semibold">Demo</span> <span className="text-muted-foreground">· sample plans and people. Nothing is real.</span></p>
        <Link href="/sign-in" className={linkButton({ variant: 'ghost', size: 'sm', className: 'min-h-9' })}>Sign in</Link>
      </div>
    </div>
  );
}
