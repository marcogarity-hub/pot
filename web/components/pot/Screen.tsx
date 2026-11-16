import Link from 'next/link';
import type { ReactNode } from 'react';

/** Mobile-first page frame: one narrow column (max 28rem) with a 16px gutter and a home link. */
export function Screen({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 pb-12 pt-6">
      <header className="mb-8 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-heading text-xl font-bold tracking-tight">
          <span aria-hidden className="grid size-7 place-items-center rounded-full bg-primary text-sm text-primary-foreground">P</span>
          Pot
        </Link>
      </header>
      {title && <h1 className="mb-6 font-heading text-3xl font-semibold tracking-tight">{title}</h1>}
      {children}
      <footer className="mt-12 text-center text-xs text-muted-foreground">
        <Link href="/privacy" className="underline underline-offset-2">Privacy</Link>
      </footer>
    </main>
  );
}
