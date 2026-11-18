'use client';

import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { cn } from 'cn';
import { PaymentsSection } from './PaymentsSection';
import { HelpSection } from './HelpSection';
import { ProfileSection } from './ProfileSection';
import { WalletSection } from './WalletSection';
import { SecuritySection } from './SecuritySection';
import { PrivacySection } from './PrivacySection';

export const SETTINGS_SECTIONS = [
  { id: 'profile', label: 'Profile' },
  { id: 'payments', label: 'Payments' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'security', label: 'Security' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'help', label: 'Help' },
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number]['id'];

/**
 * The settings dialog: a glass sheet with a section list on the left (a horizontal scroller on phones)
 * and the chosen section on the right. Esc, the close button and the backdrop all dismiss it, and the
 * focus stays inside while it is open. The body mounts fresh each time the dialog opens, so `section`
 * is the starting point every time.
 */
export function SettingsDialog({ open, onOpenChange, section = 'profile', me }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section?: SettingsSection;
  me: { name: string | null; email: string };
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/20 transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="glass-sheet fixed inset-x-0 bottom-0 flex h-[88dvh] flex-col overflow-hidden rounded-t-sheet outline-none transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 md:inset-x-auto md:bottom-auto md:left-1/2 md:top-1/2 md:h-[min(640px,85dvh)] md:w-[min(760px,calc(100vw-2rem))] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-sheet motion-reduce:transition-none">
          <Dialog.Title className="sr-only">Settings</Dialog.Title>
          <SettingsBody initial={section} me={me} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function SettingsBody({ initial, me }: { initial: SettingsSection; me: { name: string | null; email: string } }) {
  const [current, setCurrent] = useState<SettingsSection>(initial);
  return (
    <div className="flex min-h-0 flex-1 flex-col md:flex-row">
      <nav aria-label="Settings sections" className="shrink-0 border-b border-border p-3 md:w-[200px] md:border-b-0 md:border-r md:p-4">
        <ul className="flex gap-1 overflow-x-auto md:flex-col">
          {SETTINGS_SECTIONS.map(s => {
            const active = s.id === current;
            return (
              <li key={s.id} className="shrink-0">
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  onClick={() => setCurrent(s.id)}
                  className={cn(
                    'flex min-h-11 items-center rounded-full px-4 text-[15px] whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    active ? 'bg-foreground font-semibold text-card' : 'text-foreground hover:bg-foreground/5',
                  )}
                >
                  {s.label}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 md:p-8">
        <div className="mb-4 flex justify-end">
          <Dialog.Close aria-label="Close settings" className="inline-flex size-11 items-center justify-center rounded-full text-foreground hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <X className="size-5" aria-hidden />
          </Dialog.Close>
        </div>
        {renderSection(current, me)}
      </div>
    </div>
  );
}

function renderSection(section: SettingsSection, me: { name: string | null; email: string }) {
  switch (section) {
    case 'profile': return <ProfileSection name={me.name} email={me.email} />;
    case 'payments': return <PaymentsSection />;
    case 'wallet': return <WalletSection />;
    case 'security': return <SecuritySection />;
    case 'privacy': return <PrivacySection />;
    case 'help': return <HelpSection />;
  }
}
