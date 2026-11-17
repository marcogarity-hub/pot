import { cn } from 'cn';
import { formatUnits } from 'viem';
import type { PotStatusRow } from '@/lib/realtime/usePot';

/** Ruled rows, one per member: a 14px cell, the member's name, small text tags, and the paid status as text. */
export function MemberList({ status, myAddress }: { status: PotStatusRow; myAddress: string | null }) {
  const share = formatUnits(BigInt(status.share), 18);
  const me = myAddress?.toLowerCase();
  const seatNumber = new Map(status.members.map((m, i) => [m.address, i + 1]));
  const members = [...status.members].sort((a, b) => Number(b.active) - Number(a.active));
  return (
    <ul className="divide-y divide-border border border-border">
      {members.map(m => {
        const isMe = m.address.toLowerCase() === me;
        const paid = m.has_paid && !m.has_refunded;
        const marks = [m.has_objected && 'Objected', !m.active && 'Left'].filter(Boolean);
        return (
          <li key={m.address} className={cn('flex items-center gap-3 bg-card px-4 py-3', !m.active && 'opacity-60')}>
            <span aria-hidden className={cn('block size-[14px] shrink-0 border', paid ? 'border-primary bg-primary' : 'border-input bg-card')} />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="flex min-w-0 flex-wrap items-center gap-2 font-medium">
                <span className="min-w-0 truncate">{m.name ?? m.email ?? `Member ${seatNumber.get(m.address)}`}</span>
                {isMe && <span className="bg-muted px-1.5 text-xs font-semibold">You</span>}
                {m.is_organizer && <span className="bg-muted px-1.5 text-xs font-semibold">Organizer</span>}
              </p>
              {marks.length > 0 && <p className="text-xs text-muted-foreground">{marks.join(' · ')}</p>}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <MemberStatus paid={paid} refunded={m.has_refunded} />
              <p className="money text-xs text-muted-foreground">{share} USDC</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MemberStatus({ paid, refunded }: { paid: boolean; refunded: boolean }) {
  if (refunded) return <p className="text-sm text-muted-foreground">Refunded</p>;
  if (paid) return <p className="text-sm font-semibold text-primary">Paid</p>;
  return <p className="text-sm text-muted-foreground">Not paid</p>;
}
