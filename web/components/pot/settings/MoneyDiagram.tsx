import { ArrowDown, ArrowRight, Lock, Undo2, User, Users } from 'lucide-react';
import type { ReactNode } from 'react';

const STEPS = [
  'You pay your share from your Pot wallet into the plan.',
  'The money waits in the smart contract. When the last share is in, the plan locks.',
  'After a short window for objections, the contract sends the money to the organizer.',
  'If the plan doesn’t fill, or enough people object, the contract sends each share back to the person who paid it.',
];

function Node({ icon, title, note }: { icon: ReactNode; title: string; note: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-2 rounded-group bg-card p-4 text-center">
      <span aria-hidden className="grid size-11 place-items-center rounded-full bg-muted text-foreground">{icon}</span>
      <p className="text-[15px] font-semibold leading-tight">{title}</p>
      <p className="text-[13px] leading-snug text-muted-foreground">{note}</p>
    </div>
  );
}

/**
 * Where the money goes, as one picture: wallet, then the plan's smart contract, then the organizer, with the way
 * back to each person underneath. Colour carries nothing here; the same facts are in the numbered list for screen readers.
 */
export function MoneyDiagram() {
  return (
    <figure className="space-y-3">
      <div aria-hidden className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
        <Node icon={<User className="size-5" strokeWidth={1.75} />} title="Your wallet" note="You pay your share" />
        <ArrowRight className="hidden size-5 shrink-0 text-muted-foreground md:block" strokeWidth={1.75} />
        <ArrowDown className="size-5 shrink-0 self-center text-muted-foreground md:hidden" strokeWidth={1.75} />
        <Node icon={<Lock className="size-5" strokeWidth={1.75} />} title="The plan’s pot" note="Held in the smart contract until everyone has paid" />
        <ArrowRight className="hidden size-5 shrink-0 text-muted-foreground md:block" strokeWidth={1.75} />
        <ArrowDown className="size-5 shrink-0 self-center text-muted-foreground md:hidden" strokeWidth={1.75} />
        <Node icon={<Users className="size-5" strokeWidth={1.75} />} title="The organizer" note="Gets the money once the objection window passes" />
      </div>
      <p aria-hidden className="flex items-center justify-center gap-2 rounded-group border border-dashed border-input px-4 py-3 text-[13px] text-muted-foreground">
        <Undo2 className="size-4 shrink-0" strokeWidth={1.75} />
        If the plan doesn’t fill, or enough people object, every share goes back to the person who paid it.
      </p>
      <figcaption className="sr-only">Where your money goes</figcaption>
      <ol className="sr-only">
        {STEPS.map(step => <li key={step}>{step}</li>)}
      </ol>
    </figure>
  );
}
