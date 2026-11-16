import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { PotMark } from './PotMark';

/**
 * Page frame. An app bar on a white module, then the content on the construction grid.
 * `width="narrow"` is one reading column for forms; `width="wide"` is the 12-column dashboard.
 * `nav` is the right side of the app bar (account, New pot).
 */
export function Screen({ title, children, width = 'narrow', nav }: {
  title?: string; children: ReactNode; width?: 'narrow' | 'wide'; nav?: ReactNode;
}) {
  const column = width === 'wide' ? 'max-w-6xl' : 'max-w-xl';
  return (
    <>
      <header className="border-b bg-card">
        <div className={cn('mx-auto flex h-14 w-full items-center justify-between gap-3 px-4 md:px-6', column)}>
          <Link href="/" className="flex items-center gap-2.5 font-heading text-xl font-bold tracking-tight">
            <PotMark />
            Pot
          </Link>
          {nav && <nav aria-label="Account" className="flex min-w-0 items-center gap-2 text-sm">{nav}</nav>}
        </div>
      </header>
      <main className={cn('grid-armature mx-auto w-full flex-1 px-4 pb-16 pt-8 md:px-6 md:pt-12', column)}>
        {title && <h1 className="mb-6 font-heading text-3xl font-semibold tracking-tight">{title}</h1>}
        {children}
      </main>
      <footer className="border-t bg-card">
        <div className={cn('mx-auto flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-4 text-xs text-muted-foreground md:px-6', column)}>
          <span>Test money only: USDC on the Arc testnet.</span>
          <Link href="/privacy" className="underline">Privacy</Link>
        </div>
      </footer>
    </>
  );
}
