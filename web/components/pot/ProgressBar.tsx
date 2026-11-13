import { formatUnits } from 'viem';
import { Progress } from '@/components/ui/progress';

/** "$X of $Y" pot progress, GoFundMe-style. Amounts are 18-decimal wei strings. */
export function ProgressBar({ paidCount, memberCount, share, total }: {
  paidCount: number; memberCount: number; share: string; total: string;
}) {
  const paid = BigInt(share) * BigInt(paidCount);
  const pct = memberCount === 0 ? 0 : Math.round((paidCount / memberCount) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-3xl font-semibold tabular-nums">{formatUnits(paid, 18)} <span className="text-base font-normal text-muted-foreground">USDC</span></p>
        <p className="text-sm text-muted-foreground tabular-nums">of {formatUnits(BigInt(total), 18)}</p>
      </div>
      <Progress value={pct} aria-label="Pot progress" className="[&_[data-slot=progress-track]]:h-3" />
      <p className="text-sm text-muted-foreground">{paidCount} of {memberCount} paid</p>
    </div>
  );
}
