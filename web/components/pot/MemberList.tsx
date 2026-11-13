import { formatUnits } from 'viem';
import { Badge } from '@/components/ui/badge';
import type { PotStatusRow } from '@/lib/realtime/usePot';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** One row per person with their share and status, Billy-style. */
export function MemberList({ status, myAddress }: { status: PotStatusRow; myAddress: string | null }) {
  const share = formatUnits(BigInt(status.share), 18);
  const me = myAddress?.toLowerCase();
  const members = [...status.members].sort((a, b) => Number(b.active) - Number(a.active));
  return (
    <ul className="divide-y rounded-xl border">
      {members.map(m => {
        const isMe = m.address.toLowerCase() === me;
        return (
          <li key={m.address} className={`flex items-center justify-between gap-3 px-4 py-3 ${m.active ? '' : 'opacity-60'}`}>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {m.email ?? short(m.address)}
                {isMe && <span className="text-muted-foreground"> (you)</span>}
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {m.is_organizer && <Badge variant="outline">Organizer</Badge>}
                {m.has_objected && <Badge variant="destructive">Objected</Badge>}
                {!m.active && <Badge variant="outline">Left</Badge>}
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-sm tabular-nums">{share} USDC</p>
              <MemberState paid={m.has_paid} refunded={m.has_refunded} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MemberState({ paid, refunded }: { paid: boolean; refunded: boolean }) {
  if (refunded) return <Badge variant="secondary">Refunded</Badge>;
  if (paid) return <Badge>Paid</Badge>;
  return <Badge variant="outline">Not yet</Badge>;
}
