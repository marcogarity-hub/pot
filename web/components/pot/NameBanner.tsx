'use client';

import { Button } from '@/components/ui/button';
import { useOpenSettings } from './AppShell';

/** Slim prompt shown until a display name is set. The button opens the Settings profile section. */
export function NameBanner() {
  const openSettings = useOpenSettings();
  return (
    <section aria-label="Add your name" className="flex flex-col gap-3 rounded-group bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-[15px]">Add your name so friends see you, not just a number.</p>
      <Button variant="outline" className="shrink-0" onClick={() => openSettings('profile')}>Add your name</Button>
    </section>
  );
}
