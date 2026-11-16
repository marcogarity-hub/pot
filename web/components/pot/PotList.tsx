import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { MemberCells } from './MemberCells';
import { formatUsdc } from './DashboardParts';
import { StateLabel } from './StateLabel';
import { stateInfo } from './potState';

export type PotSummary = {
  pot_id: string; title: string | null; state: number; receipt_hash: string | null; total: string; share: string;
  is_organizer: boolean | null; members: Array<{ has_paid: boolean; has_refunded: boolean; active: boolean }>;
};

/** The viewer's pots as ruled rows: name, one cell per member, amount, state. */
export function PotList({ pots }: { pots: PotSummary[] }) {
  if (pots.length === 0) {
    return (
      <p className="border border-dashed border-input bg-card p-6 text-sm text-muted-foreground">
        No pots yet. Start one, or open an invite link a friend sent you.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border border border-border bg-card">
      {pots.map(p => {
        const active = p.members.filter(m => m.active).length;
        const paid = p.members.filter(m => m.has_paid && !m.has_refunded).length;
        return (
          <li key={p.pot_id}>
            <Link
              href={`/pots/${p.pot_id}`}
              className="grid items-center gap-x-4 gap-y-3 px-4 py-4 transition-colors hover:bg-secondary/60 md:grid-cols-12 md:px-5"
            >
              <div className="min-w-0 md:col-span-4">
                <p className="truncate font-semibold">{p.title ?? `Pot #${p.pot_id}`}</p>
                <p className="text-xs text-muted-foreground">{p.is_organizer ? 'You organize' : 'You are a member'}</p>
              </div>
              <div className="min-w-0 space-y-1.5 md:col-span-3">
                <MemberCells members={p.members} />
                <p className="money text-xs text-muted-foreground">{paid} of {active} paid</p>
              </div>
              <div className="flex items-center justify-between gap-4 md:col-span-5 md:justify-end">
                <span className="money whitespace-nowrap text-sm font-semibold">{formatUsdc(BigInt(p.total))} USDC</span>
                <span className="flex items-center gap-2">
                  <StateLabel info={stateInfo(p)} />
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
