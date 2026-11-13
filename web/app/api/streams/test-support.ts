import { encodeAbiParameters, encodeEventTopics, type Hex } from 'viem';
import { potAbi } from '@/lib/pot';
import type { DecodedEvent } from './decode';
export const abi = potAbi;
export const address = '0xf842F699128A2e575d20BcC92F0472C7ad59e5C8';
export const alice = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const bob = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
export const receipt = `0x${'ab'.repeat(32)}`;
export function event(name: DecodedEvent['name'], args: DecodedEvent['args'] = {}, index = 0): DecodedEvent {
  return { potId: '1', name, txHash: `0x${'12'.repeat(32)}`, logIndex: index, blockNumber: '9007199254740993', args: { potId: '1', ...args } };
}
export const created = event('PotCreated', { organizer: alice, members: [alice, bob], total: '600000000000000000000', share: '300000000000000000000', deadline: '1800000000', threshold: '2', objectionWindow: '120', requestWindow: '600' });
export function paidLog(index = 1) {
  return { address, topics: encodeEventTopics({ abi, eventName: 'Paid', args: { potId: BigInt(1), member: alice } }), data: encodeAbiParameters([{ type: 'uint256' }], [BigInt('300000000000000000000')]), blockNumber: '0x20000000000001', logIndex: `0x${index.toString(16)}`, transactionHash: `0x${'12'.repeat(32)}` as Hex, removed: false };
}
