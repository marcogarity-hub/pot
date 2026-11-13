import { keccak256, toBytes } from 'viem';
import { PotState } from '@/lib/pot/chain';
import type { PotStatusRow } from '@/lib/realtime/usePot';

export type Action = 'pay' | 'requestRelease' | 'object' | 'refund' | 'finalize' | 'expire' | 'swap';

const ms = (iso: string | null) => (iso ? Date.parse(iso) : NaN);

/** What the viewer can do right now. Time boundaries follow spec A8 at equality. */
export function availableActions(s: PotStatusRow, myAddress: string | null, now: Date): Action[] {
  const t = now.getTime();
  const me = myAddress?.toLowerCase() ?? null;
  const isOrganizer = me !== null && s.organizer_address.toLowerCase() === me;
  const mine = me === null ? undefined : s.members.find(m => m.address.toLowerCase() === me && m.active);
  const canRefund = !!mine && mine.has_paid && !mine.has_refunded;
  const out: Action[] = [];

  switch (s.state) {
    case PotState.Funding: {
      const beforeDeadline = t < ms(s.deadline);
      if (beforeDeadline) {
        if (mine && !mine.has_paid) out.push('pay');
        if (isOrganizer) out.push('swap');
      } else if (canRefund) out.push('refund');
      break;
    }
    case PotState.Locked: {
      if (isOrganizer) out.push('requestRelease');
      const expiresAt = ms(s.locked_at) + s.request_window_seconds * 1000;
      if (me !== null && t >= expiresAt) out.push('expire');
      break;
    }
    case PotState.PayoutRequested: {
      const eligibleAt = ms(s.release_eligible_at);
      if (t < eligibleAt) {
        if (mine && !mine.has_objected) out.push('object');
      } else if (s.objections_count < s.threshold) out.push('finalize');
      break;
    }
    case PotState.Frozen:
      if (canRefund) out.push('refund');
      break;
  }
  return out;
}

/** A12: show receipt text only if it hashes to the on-chain receipt_hash. */
export function verifiedReceipt(text: string | null, hash: string | null): string | null {
  if (text === null || hash === null) return null;
  return keccak256(toBytes(text)).toLowerCase() === hash.toLowerCase() ? text : null;
}
