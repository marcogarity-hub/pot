import { cn } from 'cn';
import { formatUnits } from 'viem';
import type { PotStatusRow } from '@/lib/realtime/usePot';

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Initials from the email's local part, or from the wallet address when there's no email. */
export function initialsFor(m: { email: string | null; address: string }): string {
  const source = m.email ? m.email.split('@')[0] : m.address.slice(2);
  return source.slice(0, 2).toUpperCase();
}

/** One row per person: avatar, email, share, and a Paid / Not paid / Refunded chip. */
export function MemberList({ status, myAddress }: { status: PotStatusRow; myAddress: string | null }) {
  const share = formatUnits(BigInt(status.share), 18);
  const me = myAddress?.toLowerCase();
  const members = [...status.members].sort((a, b) => Number(b.active) - Number(a.active));
  return (
    <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
      {members.map(m => {
        const isMe = m.address.toLowerCase() === me;
        return (
          <li key={m.address} className={cn('flex items-center gap-3 px-4 py-3', !m.active && 'opacity-60')}>
            <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              {initialsFor(m)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">
                {m.email ?? short(m.address)}
                {isMe && <span className="text-muted-foreground"> (you)</span>}
              </p>
              {(m.is_organizer || m.has_objected || !m.active) && (
                <p className="text-xs text-muted-foreground">
                  {[m.is_organizer && 'Organizer', m.has_objected && 'Objected', !m.active && 'Left'].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1">
              <p className="money text-sm text-muted-foreground">{share} USDC</p>
              <MemberChip paid={m.has_paid} refunded={m.has_refunded} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MemberChip({ paid, refunded }: { paid: boolean; refunded: boolean }) {
  const base = 'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium';
  if (refunded) return <span className={cn(base, 'bg-secondary text-secondary-foreground')}>Refunded</span>;
  if (paid) return <span className={cn(base, 'bg-success-soft text-success')}><span aria-hidden className="size-1.5 rounded-full bg-current" />Paid</span>;
  return <span className={cn(base, 'border border-input text-muted-foreground')}>Not paid</span>;
}
