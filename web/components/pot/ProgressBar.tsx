import type { ReactNode } from 'react';
import { formatUnits } from 'viem';
import { Progress } from '@/components/ui/progress';

/** Big "X USDC of Y USDC" header, a thick bar, and "N of M paid". Amounts are 18-decimal wei strings. */
export function ProgressBar({ paidCount, memberCount, share, total, aside }: {
  paidCount: number; memberCount: number; share: string; total: string; aside?: ReactNode;
}) {
  const paid = BigInt(share) * BigInt(paidCount);
  const pct = memberCount === 0 ? 0 : Math.round((paidCount / memberCount) * 100);
  return (
    <div className="space-y-4">
      <p className="money font-heading text-4xl font-semibold tracking-tight">
        {formatUnits(paid, 18)} <span className="text-lg font-medium text-muted-foreground">USDC</span>
        <span className="block text-base font-normal text-muted-foreground">of {formatUnits(BigInt(total), 18)} USDC</span>
      </p>
      <Progress value={pct} aria-label="Pot progress" className="gap-0 [&_[data-slot=progress-track]]:h-4 [&_[data-slot=progress-indicator]]:rounded-full" />
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="font-medium">{paidCount} of {memberCount} paid</p>
        {aside}
      </div>
    </div>
  );
}
