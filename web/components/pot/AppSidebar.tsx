'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleHelp, History, House, Plus, Wallet, type LucideIcon } from 'lucide-react';
import { cn } from 'cn';
import { linkButton } from './linkButton';
import { PotMark } from './PotMark';
import { AccountMenu } from './AccountMenu';
import type { SettingsSection } from './settings/SettingsDialog';

/** Rows under New plan, each a page. Add a row (a People page, say) by adding a line here. */
const NAV: Array<{ label: string; href: string; icon: LucideIcon }> = [
  { label: 'Home', href: '/', icon: House },
  { label: 'History', href: '/history', icon: History },
  { label: 'Wallet', href: '/wallet', icon: Wallet },
  { label: 'Help', href: '/help', icon: CircleHelp },
];

const ROW = 'flex min-h-11 w-full items-center gap-3 rounded-full px-3 text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * The desktop sidebar: a floating glass panel with the wordmark, the one coral New plan action, a list of page
 * links (Home, History, Wallet, Help) and the account menu at the foot. The current page's link is a solid black
 * pill with aria-current. Hidden below md, where AppShell's tab bar takes over.
 */
export function AppSidebar({ me, onOpenSettings, defaultAccountMenuOpen }: {
  me: { name: string | null; email: string };
  onOpenSettings: (section: SettingsSection) => void;
  /** Fixture only: shows the account menu open. */
  defaultAccountMenuOpen?: boolean;
}) {
  const pathname = usePathname();
  return (
    <aside aria-label="Sidebar" className="glass hidden rounded-group p-4 md:fixed md:inset-y-4 md:left-4 md:z-30 md:flex md:w-[232px] md:flex-col">
      <Link href="/" className="flex items-center gap-2 px-3 pb-4 pt-1 text-[17px] font-bold tracking-tight">
        <PotMark />
        Pot
      </Link>
      <Link href="/new" className={linkButton({ size: 'lg', className: 'w-full' })}>
        <Plus className="size-5" strokeWidth={2} aria-hidden />
        New plan
      </Link>
      <nav aria-label="Sections" className="mt-4">
        <ul className="space-y-1">
          {NAV.map(({ label, href, icon: Icon }) => {
            const current = pathname === href;
            return (
              <li key={label}>
                <Link href={href} aria-current={current ? 'page' : undefined}
                  className={cn(ROW, current ? 'bg-foreground font-semibold text-card' : 'text-foreground hover:bg-foreground/5')}>
                  <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="mt-auto pt-6">
        <AccountMenu name={me.name} email={me.email} onOpenSettings={onOpenSettings} defaultOpen={defaultAccountMenuOpen} />
      </div>
    </aside>
  );
}
