'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from 'cn';
import { linkButton } from './linkButton';
import { PotMark } from './PotMark';
import { AccountMenu } from './AccountMenu';
import type { SettingsSection } from './settings/SettingsDialog';

export type ShellPot = { id: string; title: string | null; needsYou?: boolean; stateLabel?: string };

/**
 * The desktop sidebar: a floating glass panel with the wordmark, the one coral New pot action, the viewer's
 * pots (a dot and a title each, with a "Needs you" word when a pot is waiting on them) and the account menu
 * at the foot. It scrolls when the list is long. Hidden below md, where AppShell's tab bar takes over.
 */
export function AppSidebar({ me, pots, activePotId, onOpenSettings, defaultAccountMenuOpen }: {
  me: { name: string | null; email: string };
  pots: ShellPot[];
  activePotId?: string;
  onOpenSettings: (section: SettingsSection) => void;
  /** Fixture only: shows the account menu open. */
  defaultAccountMenuOpen?: boolean;
}) {
  return (
    <aside aria-label="Sidebar" className="glass hidden rounded-group p-4 md:fixed md:inset-y-4 md:left-4 md:z-30 md:flex md:w-[232px] md:flex-col">
      <Link href="/" className="flex items-center gap-2 px-3 pb-4 pt-1 text-[17px] font-bold tracking-tight">
        <PotMark />
        Pot
      </Link>
      <Link href="/new" className={linkButton({ size: 'lg', className: 'w-full' })}>
        <Plus className="size-5" strokeWidth={2} aria-hidden />
        New pot
      </Link>
      {pots.length > 0 && (
        <nav aria-label="Your pots" className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <p className="px-3 pb-2 text-[13px] text-muted-foreground">Your pots</p>
          <ul className="space-y-1">
            {pots.map(p => {
              const detail = [p.needsYou ? 'Needs you' : null, p.stateLabel].filter(Boolean).join(' · ');
              return (
                <li key={p.id}>
                  <Link
                    href={`/pots/${p.id}`}
                    aria-current={p.id === activePotId ? 'page' : undefined}
                    className="flex min-h-11 items-center gap-3 rounded-full px-3 text-[15px] hover:bg-foreground/5 aria-[current=page]:bg-foreground/5 aria-[current=page]:font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', p.needsYou ? 'bg-foreground' : 'border border-foreground/40')} />
                    <span className="min-w-0">
                      <span className="block truncate">{p.title ?? 'Untitled pot'}</span>
                      {detail && <span className="block truncate text-[13px] text-muted-foreground">{detail}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
      <div className="mt-auto pt-6">
        <AccountMenu name={me.name} email={me.email} onOpenSettings={onOpenSettings} defaultOpen={defaultAccountMenuOpen} />
      </div>
    </aside>
  );
}
