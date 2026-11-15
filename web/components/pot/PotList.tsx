import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatUnits } from 'viem';
import { PotState } from '@/lib/pot/chain';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export type PotSummary = {
  pot_id: string; title: string | null; state: number; total: string; share: string;
  is_organizer: boolean | null; members: Array<{ has_paid: boolean; has_refunded: boolean; active: boolean }>;
};

const LABEL: Record<number, string> = {
  [PotState.Funding]: 'Funding', [PotState.Locked]: 'Locked', [PotState.PayoutRequested]: 'Payout requested',
  [PotState.Released]: 'Released', [PotState.Frozen]: 'Frozen',
};

export function PotList({ pots }: { pots: PotSummary[] }) {
  if (pots.length === 0) {
    return <p className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">No pots yet. Create one, or open an invite link a friend sent you.</p>;
  }
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {pots.map(p => {
        const active = p.members.filter(m => m.active).length;
        const paid = p.members.filter(m => m.has_paid && !m.has_refunded).length;
        return (
          <li key={p.pot_id}>
            <Link href={`/pots/${p.pot_id}`} className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-muted/60">
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-medium">{p.title ?? `Pot #${p.pot_id}`}</p>
                  <Badge variant={p.state === PotState.Frozen ? 'destructive' : 'outline'}>{LABEL[p.state] ?? 'Unknown'}</Badge>
                </div>
                <Progress value={active ? Math.round((paid / active) * 100) : 0} aria-label={`${paid} of ${active} paid`}
                  className="gap-0 [&_[data-slot=progress-track]]:h-2" />
                <p className="money text-xs text-muted-foreground">
                  {paid} of {active} paid · {formatUnits(BigInt(p.total), 18)} USDC{p.is_organizer ? ' · You organize' : ''}
                </p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
