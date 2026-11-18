import { cn } from 'cn';
import { Check } from 'lucide-react';
import { formatDollars } from '@/lib/format/money';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { FaceDot } from './Faces';

/**
 * "The group": one grouped row per member with a face, the name, small tags, and the paid state as a word
 * next to the member's share in dollars. Members who are not on the server's email list show "Member N".
 */
export function MemberList({ status, myAddress }: { status: PotStatusRow; myAddress: string | null }) {
  const share = formatDollars(status.share);
  const me = myAddress?.toLowerCase();
  const seatNumber = new Map(status.members.map((m, i) => [m.address, i + 1]));
  const members = [...status.members].sort((a, b) => Number(b.active) - Number(a.active));
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-group bg-card">
      {members.map(m => {
        const isMe = m.address.toLowerCase() === me;
        const seat = seatNumber.get(m.address) ?? 0;
        const paid = m.has_paid && !m.has_refunded;
        const marks = [m.has_objected && 'Objected', !m.active && 'Left'].filter(Boolean);
        return (
          <li key={m.address} className={cn('flex items-center gap-3 px-4 py-3', !m.active && 'opacity-60')}>
            <FaceDot face={{ seat, name: m.name, email: m.email, paid }} size="md" showCheck />
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="min-w-0 truncate text-[17px] font-medium">{m.name ?? m.email ?? `Member ${seat}`}</p>
              <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-[15px] text-muted-foreground">
                {isMe && <span className="font-medium text-foreground">You</span>}
                {m.is_organizer && <span>Organizer</span>}
                {marks.length > 0 && <span>{marks.join(' · ')}</span>}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-0.5 text-right">
              <MemberStatus paid={paid} refunded={m.has_refunded} />
              <p className="money text-[15px] text-muted-foreground">{share}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MemberStatus({ paid, refunded }: { paid: boolean; refunded: boolean }) {
  if (refunded) return <p className="text-[15px] text-muted-foreground">Refunded</p>;
  if (paid) return <p className="flex items-center gap-1 text-[15px] font-semibold text-success"><Check aria-hidden className="size-4" strokeWidth={2.5} />Paid</p>;
  return <p className="text-[15px] text-muted-foreground">Not yet</p>;
}
