import { cn } from 'cn';

export type CellMember = { has_paid: boolean; has_refunded: boolean; active: boolean };

/**
 * The signature of the product: one square per active member, filled when that member's money is locked.
 * Refunded members show a struck-through outline. The text label travels with it, so colour is never alone.
 */
export function MemberCells({ members, className, size = 'sm' }: { members: CellMember[]; className?: string; size?: 'sm' | 'lg' }) {
  const px = size === 'lg' ? 32 : 14;
  const seats = members.filter(m => m.active);
  const paid = seats.filter(m => m.has_paid && !m.has_refunded).length;
  return (
    <span
      role="img"
      aria-label={`${paid} of ${seats.length} paid`}
      className={cn('inline-grid gap-1', className)}
      style={{ gridTemplateColumns: `repeat(auto-fill, ${px}px)`, gridAutoRows: `${px}px`, maxWidth: '100%' }}
    >
      {seats.map((m, i) => {
        const filled = m.has_paid && !m.has_refunded;
        return (
          <span
            key={i}
            aria-hidden
            style={{ width: px, height: px }}
            className={cn(
              'block border',
              filled ? 'border-primary bg-primary' : 'border-input bg-card',
              m.has_refunded && 'bg-[linear-gradient(to_top_right,transparent_45%,var(--input)_45%,var(--input)_55%,transparent_55%)]',
            )}
          />
        );
      })}
    </span>
  );
}
