import 'server-only';
import { createPublicClient, http, zeroAddress } from 'viem';
import { potAddress, potInterface, validAddress } from './contract';

// viem decodes the ABI's named PotView tuple into an object. Consume names
// instead of positional indexes so state/counts cannot be confused.
export type ActionPot = {
  organizer: string;
  share: bigint;
  state: number;
  threshold: bigint;
  objectionsCount: bigint;
  releaseEligibleAt: bigint;
};
export class PotNotFoundError extends Error {
  constructor() { super('PotNotFound'); }
}

export async function readPot(potId: bigint): Promise<ActionPot> {
  const { abi, chain } = potInterface();
  const result = await createPublicClient({ chain, transport: http() }).readContract({
    address: potAddress(), abi, functionName: 'getPot', args: [potId],
  });
  // Do not let a mismatched/unconfigured tuple authorize a transaction.
  const pot = result as Partial<ActionPot> | undefined;
  if (!pot || typeof pot.organizer !== 'string' || typeof pot.share !== 'bigint' ||
      !Number.isInteger(pot.state) || pot.state! < 0 || pot.state! > 4 ||
      typeof pot.threshold !== 'bigint' || typeof pot.objectionsCount !== 'bigint' ||
      typeof pot.releaseEligibleAt !== 'bigint') throw new Error('Invalid getPot result');
  if (pot.organizer.toLowerCase() === zeroAddress) throw new PotNotFoundError();
  validAddress(pot.organizer);
  return pot as ActionPot;
}
export async function chainTimestamp(): Promise<bigint> {
  const { chain } = potInterface();
  return (await createPublicClient({ chain, transport: http() }).getBlock({ blockTag: 'latest' })).timestamp;
}
