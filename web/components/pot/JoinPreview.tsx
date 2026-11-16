'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { linkButton } from './linkButton';
import { MemberCells, type CellMember } from './MemberCells';
import { StateLabel } from './StateLabel';
import type { StateInfo } from './potState';

/**
 * What the invitee sees before joining: the pot, the share, who organized it, and which account they join as.
 * Joining records nothing on-chain. The seat already exists once the organizer creates the pot.
 * `members`, `state` and `deadline` are optional: they render only when the caller has them.
 */
export function JoinPreview({ potId, title, amount, organizerEmail, email, members, state, deadline }: {
  potId: string; title: string; amount: string | null; organizerEmail: string | null; email: string;
  members?: CellMember[]; state?: Pick<StateInfo, 'label' | 'tone'>; deadline?: string;
}) {
  const [joined, setJoined] = useState(false);

  if (joined) {
    return (
      <section className="min-w-0 space-y-6 border border-border bg-card p-5 md:p-8">
        <span aria-hidden className="grid size-14 place-items-center bg-success-soft text-success">
          <Check className="size-7" />
        </span>
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-semibold tracking-tight">You&apos;ve joined</h1>
          <p className="text-sm text-muted-foreground">
            You&apos;re part of {title}{amount ? `. Your share is ${amount} USDC.` : '.'} Pay when you&apos;re ready.
          </p>
        </div>
        <Link href={`/pots/${potId}`} className={linkButton({ size: 'lg', className: 'w-full text-base' })}>
          Go to pot
        </Link>
      </section>
    );
  }

  const seats = members?.filter(m => m.active) ?? [];
  const paid = seats.filter(m => m.has_paid && !m.has_refunded).length;

  return (
    <section className="min-w-0 border border-border bg-card">
      <div className="space-y-6 p-5 md:p-8">
        <h1 className="font-heading text-3xl font-semibold leading-tight tracking-tight">{title}</h1>

        <dl className="divide-y divide-border border-y border-border text-sm">
          {amount && (
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground">Each member pays</dt>
              <dd className="money font-semibold">{`${amount} USDC`}</dd>
            </div>
          )}
          {organizerEmail && (
            <div className="grid min-w-0 grid-cols-1 gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground">Organized by</dt>
              <dd className="min-w-0 break-all font-medium">{organizerEmail}</dd>
            </div>
          )}
          {members && (
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground">Members</dt>
              <dd className="money font-semibold">{seats.length}</dd>
            </div>
          )}
          {state && (
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground">State</dt>
              <dd><StateLabel info={state} /></dd>
            </div>
          )}
          {deadline && (
            <div className="grid grid-cols-1 gap-1 py-3 sm:grid-cols-[11rem_1fr] sm:gap-4">
              <dt className="text-muted-foreground">Deadline</dt>
              <dd className="money font-medium">{deadline}</dd>
            </div>
          )}
        </dl>

        {members && (
          <div className="space-y-3">
            <MemberCells members={members} />
            <p className="money text-sm">{`${paid} of ${seats.length} paid`}</p>
          </div>
        )}

        <p className="text-sm text-muted-foreground">You&apos;ll join as <span className="font-medium text-foreground">{email}</span></p>

        <Button size="lg" className="w-full text-base" onClick={() => setJoined(true)}>Join pot</Button>
      </div>
    </section>
  );
}
