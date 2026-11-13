import { parseAbi, encodeAbiParameters, encodeEventTopics, type Hex } from 'viem';
import type { DecodedEvent } from './decode';
export const abi = parseAbi([
  'event PotCreated(uint256 indexed potId, address indexed organizer, address[] members, uint256 total, uint256 share, uint256 deadline, uint256 threshold, uint256 objectionWindow, uint256 requestWindow)',
  'event Paid(uint256 indexed potId, address indexed member, uint256 amount)',
  'event Locked(uint256 indexed potId, uint256 lockedAt)',
  'event SeatSwapped(uint256 indexed potId, address indexed leaver, address indexed replacement, uint256 refunded)',
  'event Refunded(uint256 indexed potId, address indexed member, uint256 amount)',
  'event PayoutRequested(uint256 indexed potId, bytes32 receiptHash, uint256 releaseEligibleAt)',
  'event Objected(uint256 indexed potId, address indexed member, uint256 objectionsCount)',
  'event Released(uint256 indexed potId, address indexed organizer, uint256 amount)',
  'event Expired(uint256 indexed potId)', 'event Frozen(uint256 indexed potId)',
]);
export const address = '0x1111111111111111111111111111111111111111';
export const alice = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
export const bob = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
export const receipt = `0x${'ab'.repeat(32)}`;
export function event(name: DecodedEvent['name'], args: DecodedEvent['args'] = {}, index = 0): DecodedEvent {
  return { potId: '1', name, txHash: `0x${'12'.repeat(32)}`, logIndex: index, blockNumber: '9007199254740993', args: { potId: '1', ...args } };
}
export const created = event('PotCreated', { organizer: alice, members: [alice, bob], total: '600000000000000000000', share: '300000000000000000000', deadline: '1800000000', threshold: '2', objectionWindow: '120', requestWindow: '600' });
export function paidLog(index = 1) {
  return { address, topics: encodeEventTopics({ abi, eventName: 'Paid', args: { potId: 1n, member: alice } }), data: encodeAbiParameters([{ type: 'uint256' }], [300000000000000000000n]), blockNumber: '0x20000000000001', logIndex: `0x${index.toString(16)}`, transactionHash: `0x${'12'.repeat(32)}` as Hex, removed: false };
}
