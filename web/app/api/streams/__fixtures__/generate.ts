/** Synthetic QuickNode EVM Logs payload, not a live chain capture.
 * Regenerate from web/: node --import tsx app/api/streams/__fixtures__/generate.ts */
import { writeFileSync } from 'node:fs';
import { encodeAbiParameters, encodeEventTopics, type Abi, type AbiEvent } from 'viem';
import { potAbi, type PotEventName } from '../../../../lib/pot';

const address = '0xf842F699128A2e575d20BcC92F0472C7ad59e5C8';
const alice = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const bob = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const carol = '0xcccccccccccccccccccccccccccccccccccccccc';
const share = BigInt('300000000000000000000');
const receiptHash = `0x${'ab'.repeat(32)}`;
const logs: object[] = [];
let transaction = 0;
function emit(name: PotEventName, args: Record<string, unknown>, sameTransaction = false) {
  if (!sameTransaction) transaction++;
  const event = potAbi.find(item => item.type === 'event' && item.name === name) as AbiEvent;
  const parameters = event.inputs.filter(input => !input.indexed);
  logs.push({
    address, blockNumber: `0x${(72173814 + transaction).toString(16)}`,
    transactionHash: `0x${transaction.toString(16).padStart(64, '0')}`,
    transactionIndex: '0x0', blockHash: `0x${(1000 + transaction).toString(16).padStart(64, '0')}`,
    removed: false, logIndex: `0x${logs.length.toString(16)}`,
    topics: encodeEventTopics({ abi: potAbi as Abi, eventName: name, args }),
    data: encodeAbiParameters(parameters, parameters.map(input => args[input.name!])),
  });
}
function create(potId: bigint) {
  emit('PotCreated', { potId, organizer: alice, members: [alice, bob], total: share * BigInt(2), share,
    deadline: BigInt(1800000000), threshold: BigInt(1), objectionWindow: BigInt(120), requestWindow: BigInt(600) });
}
function pay(potId: bigint, member: string) { emit('Paid', { potId, member, amount: share }); }
function lock(potId: bigint) { emit('Locked', { potId, lockedAt: BigInt(1799990000) }, true); }
function request(potId: bigint) { emit('PayoutRequested', { potId, receiptHash, releaseEligibleAt: BigInt(1799990120) }); }
// Paid swap-out has no Refunded event. The replacement pays before lock/release.
create(BigInt(1)); pay(BigInt(1), alice);
emit('SeatSwapped', { potId: BigInt(1), leaver: alice, replacement: carol, refunded: share });
pay(BigInt(1), carol); pay(BigInt(1), bob); lock(BigInt(1)); request(BigInt(1));
emit('Released', { potId: BigInt(1), organizer: alice, amount: share * BigInt(2) });
// Threshold objection emits Objected and Frozen in the same transaction.
create(BigInt(2)); pay(BigInt(2), alice); pay(BigInt(2), bob); lock(BigInt(2)); request(BigInt(2));
emit('Objected', { potId: BigInt(2), member: alice, objectionsCount: BigInt(1) });
emit('Frozen', { potId: BigInt(2) }, true);
emit('Refunded', { potId: BigInt(2), member: alice, amount: share });
// Expiry emits only Expired, then members can refund in state 4.
create(BigInt(3)); pay(BigInt(3), alice); pay(BigInt(3), bob); lock(BigInt(3));
emit('Expired', { potId: BigInt(3) });
emit('Refunded', { potId: BigInt(3), member: bob, amount: share });
writeFileSync(new URL('./arc-logs.json', import.meta.url), JSON.stringify({
  data: [[logs]], metadata: { network: 'arc-testnet', chain_id: 5042002, dataset: 'logs',
    synthetic: true, deploy_block: '72173814', batch_start_range: '72173815', batch_end_range: String(72173814 + transaction) },
}, null, 2) + '\n');
