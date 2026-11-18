import Link from 'next/link';
import { cn } from 'cn';
import { formatDollars } from '@/lib/format/money';
import { Faces, type Face } from './Faces';
import { TripCover } from './TripCover';
import { stateInfo, type StateTone } from './potState';

export type PotSummary = {
  pot_id: string; title: string | null; state: number; receipt_hash: string | null; total: string; share: string;
  is_organizer: boolean | null;
  members: Array<{ has_paid: boolean; has_refunded: boolean; active: boolean; name?: string | null; email?: string | null }>;
};

/** Plain state text, coloured by tone. The words always carry the meaning; colour only reinforces it. */
const STATE_TEXT: Record<StateTone, string> = {
  accent: 'text-foreground', neutral: 'text-muted-foreground', warning: 'text-warning', success: 'text-success', danger: 'text-destructive',
};

/** The viewer's trips as cards: cover, name and state, a progress bar, the friends' faces and the money so far. */
export function PotList({ pots }: { pots: PotSummary[] }) {
  if (pots.length === 0) {
    return (
      <p className="rounded-group border border-dashed border-input bg-card p-6 text-[15px] text-muted-foreground">
        No pots yet. Start one, or open an invite link a friend sent you.
      </p>
    );
  }
  return (
    <ul className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
      {pots.map(p => {
        const faces: Face[] = p.members
          .filter(m => m.active)
          .map((m, i) => ({ seat: i + 1, name: m.name, email: m.email, paid: m.has_paid && !m.has_refunded }));
        const paid = faces.filter(f => f.paid).length;
        const pct = faces.length > 0 ? Math.round((paid / faces.length) * 100) : 0;
        const info = stateInfo(p);
        return (
          <li key={p.pot_id}>
            <Link href={`/pots/${p.pot_id}`} className="block overflow-hidden rounded-group bg-card transition-colors hover:bg-secondary/60">
              <TripCover potId={p.pot_id} className="h-[150px]" />
              <div className="space-y-3 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <p className="min-w-0 truncate font-heading text-[21px] font-semibold leading-tight">{p.title ?? `Pot #${p.pot_id}`}</p>
                  <span className={cn('shrink-0 text-[15px] font-semibold', STATE_TEXT[info.tone])}>{info.label}</span>
                </div>
                <p className="text-[13px] text-muted-foreground">
                  {p.is_organizer ? 'You organize' : 'You are a member'} · {paid} of {faces.length} paid
                </p>
                <div aria-hidden className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-pine" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <Faces faces={faces} size="sm" max={6} />
                  <p className="money whitespace-nowrap text-[15px] text-muted-foreground">
                    <span className="font-semibold text-foreground">{formatDollars(BigInt(p.share) * BigInt(paid))}</span> of {formatDollars(p.total)}
                  </p>
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
