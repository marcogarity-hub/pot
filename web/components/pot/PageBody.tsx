import type { ReactNode } from 'react';

/** The content column for a nav page: one h1 and the page's sections, centred at a comfortable reading width. */
export function PageBody({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <h1 className="font-heading text-[34px] leading-[1.05]">{title}</h1>
      {children}
    </div>
  );
}
