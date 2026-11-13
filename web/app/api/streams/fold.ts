import type { DecodedEvent } from './decode';
export type PotRow = {
  pot_id: string; organizer_address: string; total: string; share: string;
  deadline: string; threshold: number; objection_window_seconds: number;
  request_window_seconds: number; locked_at: string | null; state: number;
  payments_count: number; objections_count: number; receipt_hash: string | null;
  release_eligible_at: string | null;
};
export type MemberRow = { pot_id: string; address: string; has_paid: boolean; has_objected: boolean; has_refunded: boolean; active: boolean };
const MAX_TIMESTAMP_SECONDS = BigInt('253402300799');
const timestamp = (seconds: string) => {
  const value = BigInt(seconds);
  const safeValue = value > MAX_TIMESTAMP_SECONDS ? MAX_TIMESTAMP_SECONDS : value;
  return new Date(Number(safeValue * BigInt(1000))).toISOString();
};

/** Deterministic chain-only projection. Persistence adds updated_at. */
export function foldPot(input: DecodedEvent[]): { pot: PotRow; members: MemberRow[] } {
  const unique = new Map(input.map(e => [`${e.txHash.toLowerCase()}:${e.logIndex}`, e]));
  const events = [...unique.values()].sort((a, b) => BigInt(a.blockNumber) < BigInt(b.blockNumber) ? -1 : BigInt(a.blockNumber) > BigInt(b.blockNumber) ? 1 : a.logIndex - b.logIndex);
  let pot: PotRow | undefined;
  const members = new Map<string, MemberRow>();
  const add = (address: string, potId: string) => members.set(address.toLowerCase(), { pot_id: potId, address: address.toLowerCase(), active: true, has_paid: false, has_objected: false, has_refunded: false });
  const member = (address: string) => {
    const row = members.get(address.toLowerCase());
    if (!row) throw new Error('Event references an unknown member');
    return row;
  };
  for (const e of events) {
    const a = e.args;
    const arg = (key: string): string => {
      if (typeof a[key] !== 'string') throw new Error(`Missing ${key}`);
      return a[key];
    };
    if (e.name === 'PotCreated') {
      if (pot || !Array.isArray(a.members)) throw new Error('Invalid PotCreated history');
      pot = { pot_id: e.potId, organizer_address: arg('organizer').toLowerCase(), total: arg('total'), share: arg('share'), deadline: timestamp(arg('deadline')), threshold: Number(arg('threshold')), objection_window_seconds: Number(arg('objectionWindow')), request_window_seconds: Number(arg('requestWindow')), state: 0, locked_at: null, payments_count: 0, objections_count: 0, receipt_hash: null, release_eligible_at: null };
      a.members.forEach(address => add(address, e.potId));
      continue;
    }
    // A newer batch may arrive before PotCreated; fail so Streams retries it.
    if (!pot || pot.pot_id !== e.potId) throw new Error('Missing PotCreated or mixed pots');
    switch (e.name) {
      case 'Paid': member(arg('member')).has_paid = true; pot.payments_count++; break;
      case 'Locked': pot.state = 1; pot.locked_at = timestamp(arg('lockedAt')); break;
      case 'SeatSwapped': {
        const leaver = member(arg('leaver'));
        leaver.active = false;
        if (BigInt(arg('refunded')) > BigInt(0)) { leaver.has_refunded = true; pot.payments_count--; }
        add(arg('replacement'), e.potId); break;
      }
      case 'Refunded': member(arg('member')).has_refunded = true; break;
      case 'PayoutRequested': pot.state = 2; pot.receipt_hash = arg('receiptHash'); pot.release_eligible_at = timestamp(arg('releaseEligibleAt')); break;
      case 'Objected': member(arg('member')).has_objected = true; pot.objections_count = Number(arg('objectionsCount')); break;
      case 'Frozen': case 'Expired': pot.state = 4; break;
      case 'Released': pot.state = 3; break;
    }
  }
  if (!pot) throw new Error('Missing PotCreated');
  return { pot, members: [...members.values()].sort((a, b) => a.address.localeCompare(b.address)) };
}
