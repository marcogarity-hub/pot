import { decodeEventLog, type Abi, type Hex } from 'viem';

export const eventNames = ['PotCreated', 'Paid', 'Locked', 'SeatSwapped', 'Refunded', 'PayoutRequested', 'Objected', 'Released', 'Expired', 'Frozen'] as const;
export type PotEventName = typeof eventNames[number];
export type DecodedEvent = {
  potId: string; name: PotEventName; txHash: string; logIndex: number;
  blockNumber: string; args: Record<string, string | string[]>;
};

/** Accept the raw EVM logs dataset (data[block][receipt][log]) or arrays
 * flattened by the Stream's address/topic filter. ABI is supplied by the caller. */
export function decodePotLogs(payload: unknown, abi: Abi, potAddress: string): DecodedEvent[] {
  if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
    throw new Error('Expected a Streams data array');
  }
  const events: DecodedEvent[] = [];
  function visit(value: unknown): void {
    if (Array.isArray(value)) { value.forEach(visit); return; }
    if (!value || typeof value !== 'object' || !('address' in value)) throw new Error('Invalid log');
    const log = value as Record<string, unknown>;
    if (String(log.address).toLowerCase() !== potAddress.toLowerCase()) return;
    if (log.removed) throw new Error('Removed logs require canonical backfill');
    if (!Array.isArray(log.topics) || !log.topics.length || typeof log.data !== 'string') throw new Error('Invalid log encoding');
    const decoded = decodeEventLog({ abi, data: log.data as Hex, topics: log.topics as [Hex, ...Hex[]], strict: true });
    if (!eventNames.includes(decoded.eventName as PotEventName)) return;
    const args = Object.fromEntries(Object.entries(decoded.args ?? {}).map(([key, value]) => [key,
      Array.isArray(value) ? value.map(v => String(v).toLowerCase()) : String(value).toLowerCase(),
    ]));
    const logIndex = Number(BigInt(String(log.logIndex)));
    const blockNumber = BigInt(String(log.blockNumber)).toString();
    if (!Number.isSafeInteger(logIndex) || logIndex < 0 || BigInt(blockNumber) < 0 || typeof args.potId !== 'string' || !/^\d+$/.test(args.potId) || typeof log.transactionHash !== 'string' || !/^0x[\da-f]{64}$/i.test(log.transactionHash)) throw new Error('Invalid log identity');
    events.push({ potId: args.potId, name: decoded.eventName as PotEventName, txHash: log.transactionHash.toLowerCase(), logIndex, blockNumber, args });
  }
  payload.data.forEach(visit);
  return events;
}
