import { Suspense } from 'react';
import { PotStatus } from '@/components/pot/PotStatus';
import { Screen } from '@/components/pot/Screen';

// params are runtime data under Cache Components, so they resolve inside Suspense.
// The pot page is full-bleed (cover art under floating glass), so it takes the flush frame.
export default function PotPage({ params }: PageProps<'/pots/[potId]'>) {
  return (
    <Screen flush>
      <Suspense fallback={<p className="px-4 py-6 text-[15px] text-muted-foreground">Loading pot…</p>}>
        {params.then(({ potId }) => <PotStatus potId={potId} />)}
      </Suspense>
    </Screen>
  );
}
