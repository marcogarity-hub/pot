import { Suspense } from 'react';
import { CreatePotForm } from '@/components/pot/CreatePotForm';
import { runAgainInitial } from '@/components/pot/runAgain.server';
import { newPotStart } from '@/components/pot/newPotStart';
import { Screen } from '@/components/pot/Screen';
import { SignedInFrame } from '@/components/pot/SignedInFrame';

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

// The create form floats its own submit bar on phones, so the phone tab bar is hidden.
export default function NewPotPage({ searchParams }: PageProps<'/new'>) {
  return (
    <Screen flush>
      <Suspense fallback={null}>
        <SignedInFrame hideTabBar>
          <PresetForm searchParams={searchParams} />
        </SignedInFrame>
      </Suspense>
    </Screen>
  );
}
