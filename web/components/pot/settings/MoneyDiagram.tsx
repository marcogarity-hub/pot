import { ArrowDown, ArrowRight, Lock, Undo2, User, Users } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from 'cn';

const STEPS = [
  'You pay your share from your Pot wallet into the plan.',
  'The money waits in the smart contract. When the last share is in, the plan locks.',
  'After a short window for objections, the contract sends the money to the organizer.',
  'If the plan doesn’t fill, or enough people object, the contract sends each share back to the person who paid it.',
];

/* Hues for text and icons on each tint. All pass AA (4.5:1) on their tint. */
const SKY_INK = 'text-[#2F6488]';
const PINE_INK = 'text-[#1F4D3A]';
const AMBER_INK = 'text-[#9A5B00]';
const ROSE_INK = 'text-[#8E2F5A]';

function Node({ tint, ink, icon, title, note }: { tint: string; ink: string; icon: ReactNode; title: string; note: string }) {
  return (
    <div className={cn('flex min-w-0 flex-col items-center gap-2 rounded-group p-4 text-center', tint)}>
      <span aria-hidden className={cn('grid size-11 place-items-center rounded-full bg-white/80', ink)}>{icon}</span>
      <p className={cn('text-[15px] font-semibold leading-tight', ink)}>{title}</p>
      <p className="text-[14px] leading-snug text-foreground">{note}</p>
    </div>
  );
}

/**
 * Where the money goes, as one picture: wallet, then the plan's smart contract, then the organizer, with the way
 * back to each person underneath. The colours are decoration; the same facts are in the numbered list for screen readers.
 */
export function MoneyDiagram() {
  return (
    <figure className="space-y-3">
      <div aria-hidden className="grid grid-cols-1 items-stretch gap-2 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:gap-3">
        <Node tint="tint-sky" ink={SKY_INK} icon={<User className="size-5" strokeWidth={1.75} />} title="Your wallet" note="You pay your share" />
        <ArrowRight className={cn('hidden size-6 shrink-0 self-center md:block', SKY_INK)} strokeWidth={2} />
        <ArrowDown className={cn('size-6 shrink-0 justify-self-center self-center md:hidden', SKY_INK)} strokeWidth={2} />
        <Node tint="tint-sage" ink={PINE_INK} icon={<Lock className="size-5" strokeWidth={1.75} />} title="The plan’s pot" note="Held in the smart contract until everyone has paid" />
        <ArrowRight className={cn('hidden size-6 shrink-0 self-center md:block', PINE_INK)} strokeWidth={2} />
        <ArrowDown className={cn('size-6 shrink-0 justify-self-center self-center md:hidden', PINE_INK)} strokeWidth={2} />
        <Node tint="tint-butter" ink={AMBER_INK} icon={<Users className="size-5" strokeWidth={1.75} />} title="The organizer" note="Gets the money once the objection window passes" />
      </div>
      <p aria-hidden className={cn('tint-rose relative flex items-center justify-center gap-2 overflow-hidden rounded-group px-4 py-3 text-center text-[14px] font-medium', ROSE_INK)}>
        <span aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:repeating-linear-gradient(45deg,rgba(142,47,90,0.07)_0_1px,transparent_1px_7px)]" />
        <Undo2 className="relative size-5 shrink-0" strokeWidth={1.75} />
        <span className="relative">If the plan doesn’t fill, or enough people object, every share goes back to the person who paid it.</span>
      </p>
      <figcaption className="sr-only">Where your money goes</figcaption>
      <ol className="sr-only">
        {STEPS.map(step => <li key={step}>{step}</li>)}
      </ol>
    </figure>
  );
}
