'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { linkButton } from '@/components/pot/linkButton';
import { PotMark } from '@/components/pot/PotMark';
import { Screen } from '@/components/pot/Screen';

/**
 * Catches errors in the screens. The message and digest are deliberately not shown: they can carry
 * server details. Retry re-renders the segment; the link goes home.
 */
export default function ScreenError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Screen>
      <section className="min-w-0 space-y-6 rounded-group border border-border bg-card p-5 md:p-8">
        <PotMark className="size-8 text-foreground" />
        <div className="space-y-3">
          <h1 className="font-heading text-4xl font-semibold leading-tight tracking-tight">Something went wrong</h1>
          <p className="text-base text-muted-foreground">We couldn&apos;t load this page. Try again in a moment.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button size="lg" onClick={() => reset()}>Try again</Button>
          <Link href="/" className={linkButton({ size: 'lg', variant: 'outline' })}>Go home</Link>
        </div>
      </section>
    </Screen>
  );
}
