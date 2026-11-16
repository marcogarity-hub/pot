'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { linkButton } from './linkButton';

/**
 * What the invitee sees before joining: the pot, the share, who organized it, and which account they join as.
 * Joining records nothing on-chain. The seat already exists once the organizer creates the pot.
 */
export function JoinPreview({ potId, title, amount, organizerEmail, email }: {
  potId: string; title: string; amount: string | null; organizerEmail: string | null; email: string;
}) {
  const [joined, setJoined] = useState(false);

  if (joined) {
    return (
      <Card className="py-2">
        <CardContent className="flex flex-col items-center gap-5 py-8 text-center">
          <span aria-hidden className="grid size-16 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-9" />
          </span>
          <div className="space-y-2">
            <h1 className="font-heading text-3xl font-semibold tracking-tight">You&apos;ve joined</h1>
            <p className="text-sm text-muted-foreground">
              You&apos;re part of {title}{amount ? `. Your share is ${amount} USDC.` : '.'} Pay when you&apos;re ready.
            </p>
          </div>
          <Link href={`/pots/${potId}`} className={linkButton({ size: 'lg', className: 'h-12 w-full rounded-xl text-base' })}>
            Go to pot
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="py-2">
      <CardContent className="space-y-6 py-6">
        <div className="space-y-2">
          <p className="text-sm font-medium text-primary">You&apos;re invited</p>
          <h1 className="font-heading text-3xl font-semibold tracking-tight">{title}</h1>
        </div>

        <dl className="space-y-4 rounded-2xl bg-muted/60 p-4 text-sm">
          {amount && (
            <div className="space-y-1">
              <dt className="text-muted-foreground">Your share</dt>
              <dd className="money font-heading text-3xl font-semibold tracking-tight">{`${amount} USDC`}</dd>
            </div>
          )}
          {organizerEmail && (
            <div className="space-y-1">
              <dt className="text-muted-foreground">Organized by</dt>
              <dd className="font-medium">{organizerEmail}</dd>
            </div>
          )}
        </dl>

        <p className="text-sm text-muted-foreground">You&apos;ll join as <span className="font-medium text-foreground">{email}</span></p>

        <Button size="lg" className="h-12 w-full rounded-xl text-base" onClick={() => setJoined(true)}>Join pot</Button>
      </CardContent>
    </Card>
  );
}
