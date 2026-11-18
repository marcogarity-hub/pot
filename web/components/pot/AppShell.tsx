'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { House, Plus, User, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { AppSidebar, type ShellPot } from './AppSidebar';
import { SettingsDialog, type SettingsSection } from './settings/SettingsDialog';

const OpenSettingsContext = createContext<(section?: SettingsSection) => void>(() => {});

/** Lets any page inside the frame open the Settings dialog (e.g. an "Add your name" banner). A no-op outside the frame. */
export function useOpenSettings(): (section?: SettingsSection) => void {
  return useContext(OpenSettingsContext);
}

/**
 * The signed-in frame. md and up: a floating glass sidebar on the left and the page in the space beside it.
 * Below md: the page, with a glass tab bar at the bottom (Trips, New, and You, which opens Settings).
 * Settings state lives here, so the sidebar's account menu and the tab bar open the same dialog.
 * `hideTabBar` drops the phone tab bar on pages that float their own action bar at the bottom (a pot, the create form).
 */
export function AppShell({ me, pots, activePotId, hideTabBar = false, children }: {
  me: { name: string | null; email: string };
  pots: ShellPot[];
  activePotId?: string;
  hideTabBar?: boolean;
  children: ReactNode;
}) {
  const [settings, setSettings] = useState<{ open: boolean; section: SettingsSection }>({ open: false, section: 'profile' });
  const openSettings = (section: SettingsSection) => setSettings({ open: true, section });

  return (
    <OpenSettingsContext.Provider value={(section = 'profile') => openSettings(section)}>
    <div className={cn('min-h-dvh md:pb-0', !hideTabBar && 'pb-28')}>
      <AppSidebar me={me} pots={pots} activePotId={activePotId} onOpenSettings={openSettings} />
      <div className="min-h-dvh md:pl-[264px]">{children}</div>
      {!hideTabBar && <MobileTabBar onYou={() => openSettings('profile')} />}
      <SettingsDialog
        open={settings.open}
        section={settings.section}
        me={me}
        onOpenChange={open => setSettings(s => ({ ...s, open }))}
      />
    </div>
    </OpenSettingsContext.Provider>
  );
}

const TABS: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: 'Trips', href: '/', icon: House },
  { label: 'New', href: '/new', icon: Plus },
];

const TAB = 'flex h-full min-h-11 w-full flex-col items-center justify-center gap-0.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Phone tab bar: a floating glass pill above the home indicator. The current tab is a solid black fill and aria-current. */
function MobileTabBar({ onYou }: { onYou: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 z-40 px-4 md:hidden" style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 12px)' }}>
      <ul className="glass mx-auto flex max-w-sm list-none items-stretch gap-1 rounded-full p-1.5">
        {TABS.map(({ label, href, icon: Icon }) => {
          const current = pathname === href;
          return (
            <li key={label} className="flex-1">
              <Link href={href} aria-current={current ? 'page' : undefined}
                className={cn(TAB, current ? 'bg-foreground text-card' : 'text-foreground hover:bg-foreground/5')}>
                <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
        <li className="flex-1">
          <button type="button" onClick={onYou} aria-haspopup="dialog" className={cn(TAB, 'text-foreground hover:bg-foreground/5')}>
            <User className="size-5" strokeWidth={1.75} aria-hidden />
            You
          </button>
        </li>
      </ul>
    </nav>
  );
}
