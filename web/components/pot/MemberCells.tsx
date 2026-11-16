import { cn } from 'cn';

export type CellMember = { has_paid: boolean; has_refunded: boolean; active: boolean };

/**
 * The signature of the product: one square per active member, filled when that member's money is locked.
 * Refunded members show a struck-through outline. The text label travels with it, so colour is never alone.
 */
export function MemberCells({ members, className }: { members: CellMember[]; className?: string }) {
  const seats = members.filter(m => m.active);
  const paid = seats.filter(m => m.has_paid && !m.has_refunded).length;
  return (
    <span
      role="img"
      aria-label={`${paid} of ${seats.length} paid`}
      className={cn('inline-grid gap-1', className)}
      style={{ gridTemplateColumns: 'repeat(auto-fill, 14px)', gridAutoRows: '14px', maxWidth: '100%' }}
    >
      {seats.map((m, i) => {
        const filled = m.has_paid && !m.has_refunded;
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              'block size-[14px] border',
              filled ? 'border-primary bg-primary' : 'border-input bg-card',
              m.has_refunded && 'bg-[linear-gradient(to_top_right,transparent_45%,var(--input)_45%,var(--input)_55%,transparent_55%)]',
            )}
          />
        );
      })}
    </span>
  );
}
