import { Suspense } from 'react';
import { PotStatus } from '@/components/pot/PotStatus';
import { Screen } from '@/components/pot/Screen';
import { SignedInFrame } from '@/components/pot/SignedInFrame';

// params are runtime data under Cache Components, so they resolve inside Suspense.
// The pot page is full-bleed (cover art under floating glass), so it takes the flush frame.
// Signed in, the page sits in the sidebar frame; it floats its own action bar, so the phone tab bar is hidden.
export default function PotPage({ params }: PageProps<'/pots/[potId]'>) {
  return (
    <Screen flush>
      <Suspense fallback={<p className="px-4 py-6 text-[15px] text-muted-foreground">Loading plan…</p>}>
        {params.then(({ potId }) => (
          <SignedInFrame hideTabBar>
            <PotStatus potId={potId} />
          </SignedInFrame>
        ))}
      </Suspense>
    </Screen>
  );
}
