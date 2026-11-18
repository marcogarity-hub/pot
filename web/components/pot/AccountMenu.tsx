'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Popover } from '@base-ui/react/popover';
import { cn } from 'cn';
import { FaceDot } from './Faces';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import type { SettingsSection } from './settings/SettingsDialog';

const ITEM = 'flex min-h-11 w-full items-center rounded-full px-3 text-left text-[15px] hover:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * The account trigger at the foot of the sidebar and the menu it opens above itself. Settings and Help open
 * the settings dialog (the shell owns its state); Privacy is a page; Log out is the same sign-out as elsewhere.
 * `defaultOpen` exists only for the local visual fixture.
 */
export function AccountMenu({ name, email, onOpenSettings, defaultOpen = false }: {
  name: string | null;
  email: string;
  onOpenSettings: (section: SettingsSection) => void;
  defaultOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(defaultOpen);
  // Opening the dialog from the menu must not hand focus back to the trigger underneath it.
  const openingSettings = useRef(false);
  const label = name?.trim().split(/\s+/)[0] || email;

  function openSettings(section: SettingsSection) {
    openingSettings.current = true;
    setOpen(false);
    onOpenSettings(section);
  }

  async function logOut() {
    setOpen(false);
    await createBrowserSupabase().auth.signOut();
    router.refresh();
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-[15px] hover:bg-foreground/5 aria-expanded:bg-foreground/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <FaceDot face={{ seat: 1, name, email, paid: true }} size="sm" />
        <span className="min-w-0 truncate font-medium">{label}</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" align="start" sideOffset={8}>
          <Popover.Popup
            finalFocus={() => !openingSettings.current}
            className="glass-sheet w-[232px] rounded-group p-2 outline-none transition-opacity duration-100 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
          >
            <p className="truncate px-3 pb-2 pt-1 text-[13px] text-muted-foreground">{email}</p>
            <ul className="space-y-0.5">
              <li><button type="button" className={cn(ITEM, 'font-medium')} onClick={() => openSettings('profile')}>Settings</button></li>
              <li><Link href="/privacy" className={cn(ITEM, 'font-medium')} onClick={() => setOpen(false)}>Privacy</Link></li>
              <li><button type="button" className={cn(ITEM, 'font-medium')} onClick={() => openSettings('help')}>Help</button></li>
              <li className="mt-1 border-t border-border pt-1">
                <button type="button" className={cn(ITEM, 'font-medium')} onClick={logOut}>Log out</button>
              </li>
            </ul>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
