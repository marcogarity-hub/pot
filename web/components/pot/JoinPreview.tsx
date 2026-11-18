'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Check, Lock, Undo2, X } from 'lucide-react';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { formatDollarsFromUsdc } from '@/lib/format/money';
import { DisplayNameForm } from './DisplayNameForm';
import { FaceDot } from './Faces';
import { linkButton } from './linkButton';
import type { CellMember } from './MemberCells';
import { Screen } from './Screen';
import { StateLabel } from './StateLabel';
import { TripCover } from './TripCover';
import type { StateInfo } from './potState';

/**
 * What the invitee sees before joining, as a full-bleed trip cover with a glass sheet rising over it:
 * who invited them, the pot, their share, who is in, the two guarantees, and the one action.
 * Joining records nothing on-chain. The seat already exists once the organizer creates the pot.
 * `members`, `state` and `deadline` are optional: they render only when the caller has them.
 * Members are shown as "Member N" (the caller passes no names), and never with their emails.
 */
export function JoinPreview({ potId, title, amount, organizerEmail, organizerName, email, name, members, state, deadline }: {
  potId: string; title: string; amount: string | null; organizerEmail: string | null; organizerName?: string | null; email: string;
  /** The signed-in member's saved display name, if any. */
  name?: string | null;
  members?: CellMember[]; state?: Pick<StateInfo, 'label' | 'tone'>; deadline?: string;
}) {
  const [joined, setJoined] = useState(false);
  const organizer = organizerName || organizerEmail || null;
  const share = amount ? formatDollarsFromUsdc(amount) : null;

  if (joined) {
    return (
      <Frame potId={potId} title={title}>
        <span aria-hidden className="grid size-14 place-items-center rounded-full bg-success-soft text-success">
          <Check className="size-7" />
        </span>
        <div className="mt-4 space-y-2">
          <h1 className="font-heading text-[34px] leading-[1.05] tracking-tight">You&apos;ve joined</h1>
          <p className="text-[17px] text-muted-foreground">
            You&apos;re part of {title}{share ? `. Your share is ${share}.` : '.'} Pay when you&apos;re ready.
          </p>
        </div>
        <Link href={`/pots/${potId}`} className={linkButton({ size: 'lg', className: 'mt-6 w-full text-base' })}>
          Go to pot
        </Link>
      </Frame>
    );
  }

  const seats = members?.filter(m => m.active) ?? [];
  const paid = seats.filter(m => m.has_paid && !m.has_refunded).length;

  return (
    <Frame potId={potId} title={title}>
      <div className="flex items-center gap-2.5">
        <FaceDot face={{ seat: 1, name: organizer, paid: true }} size="sm" />
        <p className="text-[17px]">
          {organizer
            ? <><span className="font-semibold">{organizer}</span> <span className="text-muted-foreground">invited you</span></>
            : <span className="text-muted-foreground">Your organizer invited you</span>}
        </p>
      </div>

      <h1 className="mt-3 font-heading text-[34px] leading-[1.05] tracking-tight">{title}</h1>
      {state && <div className="mt-2"><StateLabel info={state} /></div>}

      {share && (
        <div className="mt-5 flex items-end justify-between gap-4 rounded-group bg-card p-5">
          <div>
            <p className="text-[15px] text-muted-foreground">Your share</p>
            <p className="money mt-1 font-heading text-[34px] leading-none">{share}</p>
          </div>
          {seats.length > 0 && <p className="money text-[15px] text-muted-foreground">split {seats.length} ways</p>}
        </div>
      )}

      {seats.length > 0 && (
        <section aria-labelledby="join-whos-in" className="mt-7">
          <div className="flex items-baseline justify-between">
            <h2 id="join-whos-in" className="text-[22px] font-semibold tracking-tight">Who&apos;s in</h2>
            <p className="money text-[15px] font-medium text-success">{`${paid} of ${seats.length} paid`}</p>
          </div>
          <ul className="mt-4 grid grid-cols-3 gap-x-2 gap-y-5 md:grid-cols-6 md:gap-x-1">
            {seats.map((m, i) => {
              const isPaid = m.has_paid && !m.has_refunded;
              return (
                <li key={i} className="flex flex-col items-center text-center">
                  <FaceDot face={{ seat: i + 1, paid: isPaid }} size="lg" showCheck />
                  <span className="mt-2 text-[17px] font-medium">{`Member ${i + 1}`}</span>
                  <span className={cn('text-[13px]', isPaid ? 'text-success' : 'text-muted-foreground')}>
                    {isPaid ? 'Paid' : 'Not yet'}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ul className="mt-7 divide-y divide-border overflow-hidden rounded-group bg-card">
        <Guarantee icon={<Lock className="size-5" />} title={`Held, not sent to ${organizer ?? 'the organizer'}`}>
          Your share waits until everyone has paid.
        </Guarantee>
        <Guarantee icon={<Undo2 className="size-5" />} title={`Not full by ${deadline ?? 'the deadline'}?`}>
          You get it back automatically.
        </Guarantee>
      </ul>

      {deadline && <p className="mt-4 text-[13px] text-muted-foreground">Deadline: <span className="money text-foreground">{deadline}</span></p>}

      <p className="mt-4 text-[15px] text-muted-foreground">You&apos;ll join as <span className="font-medium text-foreground">{email}</span></p>

      <div className="mt-4">
        <DisplayNameForm initialName={name ?? null} id="join-display-name" />
      </div>

      <Button size="lg" className="mt-6 w-full text-base" onClick={() => setJoined(true)}>Join pot</Button>
    </Frame>
  );
}

/** The full-bleed trip cover, a close control on top of it, and the glass sheet that holds the text. */
function Frame({ potId, title, children }: { potId: string; title: string; children: ReactNode }) {
  return (
    <Screen flush>
      <div className="relative min-h-dvh overflow-hidden">
        <TripCover potId={potId} title={title} className="absolute inset-0" />
        <Link
          href="/"
          aria-label="Close"
          className={cn(linkButton({ variant: 'glassArt', size: 'icon' }), 'absolute left-4 top-[calc(env(safe-area-inset-top,0px)+12px)] z-10')}
        >
          <X aria-hidden className="size-5" strokeWidth={2} />
        </Link>
        <div className="relative mx-2.5 mt-[34dvh] md:mx-auto md:mt-[14dvh] md:mb-16 md:max-w-[600px]">
          <section className="glass-sheet rounded-t-[38px] px-5 pb-[calc(env(safe-area-inset-bottom,0px)+24px)] pt-6 md:rounded-sheet md:px-8 md:pb-8 md:pt-8">
            {children}
          </section>
        </div>
      </div>
    </Screen>
  );
}

function Guarantee({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 p-4">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-thumb bg-muted text-foreground">{icon}</span>
      <div className="min-w-0">
        <p className="font-medium">{title}</p>
        <p className="text-[15px] text-muted-foreground">{children}</p>
      </div>
    </li>
  );
}
