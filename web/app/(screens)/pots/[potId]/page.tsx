import { Suspense } from 'react';
import { PotStatus } from '@/components/pot/PotStatus';
import { Screen } from '@/components/pot/Screen';

// params are runtime data under Cache Components, so they resolve inside Suspense.
export default function PotPage({ params }: PageProps<'/pots/[potId]'>) {
  return (
    <Screen>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading pot…</p>}>
        {params.then(({ potId }) => <PotStatus potId={potId} />)}
      </Suspense>
    </Screen>
  );
}
