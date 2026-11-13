import Link from 'next/link';
import type { ReactNode } from 'react';

/** Mobile-first page frame: narrow column, small header with a home link. */
export function Screen({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6">
      <header className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-lg font-semibold tracking-tight">Pot</Link>
      </header>
      {title && <h1 className="mb-6 text-2xl font-semibold tracking-tight">{title}</h1>}
      {children}
    </main>
  );
}
