import { createAdminSupabase } from '@/lib/supabase/admin';
import type { DecodedEvent } from './decode';
import type { PotRow, MemberRow } from './fold';
export interface PotStore {
  insertEvents(events: DecodedEvent[]): Promise<void>;
  loadEvents(potId: string): Promise<DecodedEvent[]>;
  upsertProjection(pot: PotRow, members: MemberRow[]): Promise<void>;
}
export function memoryStore() {
  const events = new Map<string, DecodedEvent>();
  const projections = new Map<string, { pot: PotRow; members: MemberRow[] }>();
  return {
    events, projections,
    async insertEvents(input: DecodedEvent[]) {
      for (const event of input) {
        const normalized = { ...event, txHash: event.txHash.toLowerCase() };
        const key = `${normalized.txHash}:${event.logIndex}`;
        if (!events.has(key)) events.set(key, structuredClone(normalized));
      }
    },
    async loadEvents(potId: string) { return structuredClone([...events.values()].filter(e => e.potId === potId)); },
    async upsertProjection(pot: PotRow, members: MemberRow[]) { projections.set(pot.pot_id, structuredClone({ pot, members })); },
  } satisfies PotStore & { events: typeof events; projections: typeof projections };
}
const row = (e: DecodedEvent) => ({ pot_id: e.potId, event_name: e.name, transaction_hash: e.txHash.toLowerCase(), log_index: e.logIndex, block_number: e.blockNumber, args: e.args });
function check(error: { message: string } | null) { if (error) throw new Error(error.message); }
export function supabaseStore(): PotStore {
  const db = createAdminSupabase();
  const counts = new Map<string, number>();
  return {
    async insertEvents(events) {
      if (!events.length) return;
      const { error } = await db.from('pot_events').upsert(events.map(row), { onConflict: 'transaction_hash,log_index', ignoreDuplicates: true });
      check(error);
    },
    async loadEvents(potId) {
      // Page in append-only id order so concurrent backfilled blocks cannot
      // shift earlier pages. foldPot supplies canonical chain ordering.
      const events: DecodedEvent[] = [];
      const pageSize = 500;
      for (let offset = 0; ; offset += pageSize) {
        const { data, error } = await db.from('pot_events').select('pot_id::text,event_name,transaction_hash,log_index,block_number::text,args').eq('pot_id', potId).order('id', { ascending: true }).range(offset, offset + pageSize - 1);
        check(error);
        if (!data) throw new Error('Missing event history');
        events.push(...data.map(e => ({ potId: String(e.pot_id), name: e.event_name as DecodedEvent['name'], txHash: e.transaction_hash, logIndex: e.log_index, blockNumber: String(e.block_number), args: e.args })));
        if (data.length < pageSize) break;
      }
      counts.set(potId, events.length);
      return events;
    },
    async upsertProjection(pot, members) {
      const count = counts.get(pot.pot_id);
      if (count === undefined) throw new Error('Load events before projecting');
      const { error } = await db.rpc('apply_pot_projection', { p_pot: { ...pot, updated_at: new Date().toISOString() }, p_members: members, p_event_count: count });
      check(error);
    },
  };
}
