import type { ReactNode } from 'react';
import { Progress } from '@/components/ui/progress';
import { Faces, type Face } from './Faces';

/**
 * The collecting card: money in so far (in dollars, in display type), a pine bar, the "N of M paid" count
 * and the member strip. Amounts and counts are computed by the caller. `footer` takes the live countdown.
 */
export function ProgressBar({ paidCount, memberCount, collected, total, faces, footer }: {
  paidCount: number; memberCount: number; collected: string; total: string; faces: Face[]; footer?: ReactNode;
}) {
  const pct = memberCount === 0 ? 0 : Math.round((paidCount / memberCount) * 100);
  return (
    <div className="space-y-4 rounded-group bg-card p-5 md:p-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="money font-heading text-[34px] leading-none tracking-tight md:text-[44px]">
          {collected}
          <span className="ml-2 font-sans text-[17px] font-normal tracking-normal text-muted-foreground">of {total}</span>
        </p>
        <p className="money text-[17px] font-semibold">{paidCount} of {memberCount} paid</p>
      </div>
      <Progress value={pct} aria-label="Money collected" />
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <Faces faces={faces} size="md" />
        {footer}
      </div>
    </div>
  );
}
