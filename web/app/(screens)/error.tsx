'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { linkButton } from '@/components/pot/linkButton';
import { Screen } from '@/components/pot/Screen';

/**
 * Catches errors in the screens. The message and digest are deliberately not shown: they can carry
 * server details. Retry re-renders the segment; the link goes home.
 */
export default function ScreenError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <Screen>
      <Card>
        <CardHeader>
          <CardTitle as="h1" className="font-heading text-xl">Something went wrong</CardTitle>
          <CardDescription>We couldn&apos;t load this page. Try again in a moment.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Link href="/" className={linkButton({ variant: 'outline' })}>Go home</Link>
        </CardContent>
      </Card>
    </Screen>
  );
}
