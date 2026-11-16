import type { CellMember } from './MemberCells';
import { MemberCells } from './MemberCells';

/** "N of M paid" in display type, with the member strip beneath it. Counts are computed by the caller. */
export function ProgressBar({ paidCount, memberCount, members }: {
  paidCount: number; memberCount: number; members: CellMember[];
}) {
  return (
    <div className="space-y-4">
      <p className="money font-heading text-3xl font-semibold tracking-tight">{paidCount} of {memberCount} paid</p>
      <MemberCells members={members} className="gap-1.5" />
    </div>
  );
}
