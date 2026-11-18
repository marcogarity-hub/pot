import { Suspense } from 'react';
import { CreatePotForm } from '@/components/pot/CreatePotForm';
import { runAgainInitial } from '@/components/pot/runAgain.server';
import { newPotStart } from '@/components/pot/newPotStart';
import { Screen } from '@/components/pot/Screen';

// searchParams are runtime data under Cache Components, so the form renders inside Suspense.
async function PresetForm({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const start = await newPotStart(sp, runAgainInitial);
  return (
    <CreatePotForm
      preset={typeof sp.preset === 'string' ? sp.preset : undefined}
      initial={start.initial}
      titlePlaceholder={start.titlePlaceholder}
    />
  );
}

export default function NewPotPage({ searchParams }: PageProps<'/new'>) {
  return (
    <Screen flush>
      <Suspense fallback={null}>
        <PresetForm searchParams={searchParams} />
      </Suspense>
    </Screen>
  );
}
