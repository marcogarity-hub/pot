import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from 'cn';
import { PotMark } from './PotMark';

/**
 * Page frame for the warm page: a quiet top row (wordmark left, glass controls right) and the content.
 * `width="narrow"` is one reading column; `width="wide"` is the desktop dashboard.
 * `nav` is the right side of the top row (account, New pot).
 * `flush` hands the whole screen to the page: no top row, no padding, no footer. Trip pages use it to run
 * the cover full-bleed and draw their own glass controls on top of it.
 * The bottom padding leaves room for a floating tab bar or toolbar; it is also safe-area aware (home indicator).
 */
export function Screen({ title, children, width = 'narrow', nav, flush = false }: {
  title?: string; children: ReactNode; width?: 'narrow' | 'wide'; nav?: ReactNode; flush?: boolean;
}) {
  if (flush) return <main className="flex-1">{children}</main>;
  const column = width === 'wide' ? 'max-w-6xl' : 'max-w-xl';
  return (
    <>
      <header className="pt-safe">
        <div className={cn('mx-auto flex h-14 w-full items-center justify-between gap-3 px-4 md:px-6', column)}>
          <Link href="/" className="flex items-center gap-2 text-[17px] font-bold tracking-tight">
            <PotMark />
            Pot
          </Link>
          {nav && <nav aria-label="Account" className="flex min-w-0 items-center gap-2 text-[15px]">{nav}</nav>}
        </div>
      </header>
      <main className={cn('mx-auto w-full flex-1 px-4 pb-28 pt-4 md:px-6 md:pb-16 md:pt-8', column)}>
        {title && <h1 className="mb-6 font-heading text-[34px] leading-[1.05]">{title}</h1>}
        {children}
      </main>
      <footer className="pb-safe">
        <div className={cn('mx-auto flex w-full flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 pb-24 pt-2 text-[13px] text-muted-foreground md:px-6 md:pb-6', column)}>
          <span>Test money only: USDC on the Arc testnet.</span>
          <Link href="/privacy" className="underline">Privacy</Link>
        </div>
      </footer>
    </>
  );
}
