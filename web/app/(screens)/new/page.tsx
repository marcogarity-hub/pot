import { Suspense } from 'react';
import { CreatePotForm } from '@/components/pot/CreatePotForm';
import { Screen } from '@/components/pot/Screen';

// searchParams are runtime data under Cache Components, so the form renders inside Suspense.
async function PresetForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <CreatePotForm preset={typeof sp.preset === 'string' ? sp.preset : undefined} />;
}

export default function NewPotPage({ searchParams }: PageProps<'/new'>) {
  return (
    <Screen title="New pot">
      <Suspense fallback={null}>
        <PresetForm searchParams={searchParams} />
      </Suspense>
    </Screen>
  );
}
