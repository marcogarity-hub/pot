import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  RpcError,
  buildLogEntries,
  buildPayloadBodies,
  groupLogsByBlockAndReceipt,
  halveBatchSize,
  parseArgs,
  scanBlocks,
  signQuickNodeRequest,
} from './replay-stream.mjs';

const POT = '0xf842f699128a2e575d20bcc92f0472c7ad59e5c8';
const TX_A = `0x${'aa'.repeat(32)}`;
const TX_B = `0x${'bb'.repeat(32)}`;

function rawLog({ block, txIndex, logIndex, tx = TX_A, data = '0x01' }) {
  return {
    address: POT,
    blockNumber: `0x${block.toString(16)}`,
    transactionHash: tx,
    transactionIndex: `0x${txIndex.toString(16)}`,
    blockHash: `0x${'cc'.repeat(32)}`,
    removed: false,
    logIndex: `0x${logIndex.toString(16)}`,
    topics: [`0x${'dd'.repeat(32)}`, `0x${'00'.repeat(31)}01`],
    data,
  };
}

test('parseArgs defaults and flag forms', () => {
  const defaults = parseArgs([]);
  assert.equal(defaults.url, 'http://localhost:3000/api/streams');
  assert.equal(defaults.fromBlock, undefined);
  assert.equal(defaults.toBlock, 'latest');
  assert.equal(defaults.batchBlocks, 2000);
  assert.equal(defaults.dryRun, false);

  const parsed = parseArgs(['--url=http://localhost:3120/api/streams', '--from-block', '100', '--to-block=latest', '--batch-blocks', '50', '--dry-run']);
  assert.equal(parsed.url, 'http://localhost:3120/api/streams');
  assert.equal(parsed.fromBlock, 100n);
  assert.equal(parsed.toBlock, 'latest');
  assert.equal(parsed.batchBlocks, 50);
  assert.equal(parsed.dryRun, true);

  assert.equal(parseArgs(['--to-block', '900']).toBlock, 900n);
});

test('parseArgs rejects bad values, unknown flags and missing values', () => {
  assert.throws(() => parseArgs(['--from-block', '-1']), /non-negative integer/);
  assert.throws(() => parseArgs(['--from-block', '1.5']), /non-negative integer/);
  assert.throws(() => parseArgs(['--batch-blocks', '0']), /positive integer/);
  assert.throws(() => parseArgs(['--url', 'ftp://example.com/x']), /http\(s\)/);
  assert.throws(() => parseArgs(['--url', 'not a url']), /absolute http/);
  assert.throws(() => parseArgs(['--bogus']), /Unknown argument/);
  assert.throws(() => parseArgs(['--from-block']), /needs a value/);
  assert.throws(() => parseArgs(['--dry-run=yes']), /takes no value/);
});

test('halveBatchSize halves, floors at 1 and rejects nonsense', () => {
  assert.equal(halveBatchSize(2000), 1000);
  assert.equal(halveBatchSize(3), 1);
  assert.equal(halveBatchSize(2), 1);
  assert.equal(halveBatchSize(1), 1);
  assert.throws(() => halveBatchSize(0), /positive integer/);
});

test('scanBlocks halves a rejected range and covers every block exactly once', async () => {
  const calls = [];
  const covered = [];
  const getLogs = async (from, to) => {
    calls.push([from, to]);
    if (to - from + 1n > 300n) throw new RpcError('eth_getLogs', 'range too large');
    return [];
  };
  const finalSize = await scanBlocks({
    from: 1000n,
    to: 4999n,
    batchBlocks: 2000,
    getLogs,
    onBatch: ({ from, to }) => covered.push([from, to]),
  });
  assert.equal(finalSize, 250);
  // Contiguous, non-overlapping coverage from 1000 through 4999.
  let expected = 1000n;
  for (const [from, to] of covered) {
    assert.equal(from, expected);
    assert.ok(to >= from && to - from + 1n <= 300n);
    expected = to + 1n;
  }
  assert.equal(expected, 5000n);
  assert.ok(calls.some(([from, to]) => to - from + 1n === 1000n), 'first attempt uses the full batch');
});

test('scanBlocks gives up when a single block is rejected', async () => {
  const getLogs = async () => {
    throw new RpcError('eth_getLogs', 'always rejected');
  };
  await assert.rejects(
    scanBlocks({ from: 5n, to: 9n, batchBlocks: 4, getLogs, onBatch: () => {} }),
    /always rejected/,
  );
});

test('scanBlocks backs off on HTTP 429 without halving the range', async () => {
  const sizes = [];
  const sleeps = [];
  let hits = 0;
  const getLogs = async (from, to) => {
    sizes.push(to - from + 1n);
    if (hits < 2) {
      hits += 1;
      throw new RpcError('eth_getLogs', 'HTTP 429', 429);
    }
    return [];
  };
  const finalSize = await scanBlocks({
    from: 0n, to: 9n, batchBlocks: 10, getLogs, onBatch: () => {}, sleep: async ms => sleeps.push(ms),
  });
  assert.equal(finalSize, 10);
  assert.deepEqual(sizes, [10n, 10n, 10n]);
  assert.deepEqual(sleeps, [2000, 4000]);
});

test('scanBlocks gives up after repeated 429s', async () => {
  const getLogs = async () => {
    throw new RpcError('eth_getLogs', 'HTTP 429', 429);
  };
  await assert.rejects(
    scanBlocks({ from: 0n, to: 9n, batchBlocks: 10, getLogs, onBatch: () => {}, sleep: async () => {} }),
    /HTTP 429/,
  );
});

test('scanBlocks does not halve on non-RPC errors', async () => {
  let attempts = 0;
  const getLogs = async () => {
    attempts += 1;
    throw new TypeError('fetch failed');
  };
  await assert.rejects(scanBlocks({ from: 0n, to: 10n, batchBlocks: 8, getLogs, onBatch: () => {} }), /fetch failed/);
  assert.equal(attempts, 1);
});

test('groupLogsByBlockAndReceipt orders blocks, receipts and logs', () => {
  const logs = [
    rawLog({ block: 12, txIndex: 1, logIndex: 5 }),
    rawLog({ block: 10, txIndex: 0, logIndex: 2, tx: TX_B }),
    rawLog({ block: 12, txIndex: 0, logIndex: 4, tx: TX_B }),
    rawLog({ block: 12, txIndex: 1, logIndex: 3 }),
    rawLog({ block: 10, txIndex: 0, logIndex: 1, tx: TX_B }),
  ];
  const grouped = groupLogsByBlockAndReceipt(logs);
  assert.deepEqual(grouped.map(b => b.blockNumber), [10n, 12n]);
  assert.equal(grouped[0].receipts.length, 1);
  assert.deepEqual(grouped[0].receipts[0].map(l => l.logIndex), ['0x1', '0x2']);
  assert.equal(grouped[1].receipts.length, 2);
  assert.deepEqual(grouped[1].receipts[0].map(l => l.logIndex), ['0x4']);
  assert.deepEqual(grouped[1].receipts[1].map(l => l.logIndex), ['0x3', '0x5']);
});

test('buildLogEntries produces data[block][receipt][log] with hex fields and a block timestamp', () => {
  const grouped = groupLogsByBlockAndReceipt([rawLog({ block: 0x44d48f7, txIndex: 0, logIndex: 0 })]);
  const timestamps = new Map([[0x44d48f7n, 1799990000n]]);
  const [entry] = buildLogEntries(grouped, timestamps);
  assert.equal(entry.blockNumber, '0x44d48f7');
  assert.equal(entry.receipts.length, 1);
  const [log] = entry.receipts[0];
  assert.deepEqual(Object.keys(log).sort(), [
    'address', 'blockHash', 'blockNumber', 'blockTimestamp', 'data', 'logIndex', 'removed', 'topics', 'transactionHash', 'transactionIndex',
  ]);
  assert.equal(log.address, POT);
  assert.equal(log.blockNumber, '0x44d48f7');
  assert.equal(log.blockTimestamp, '0x6b49aaf0'); // 1799990000 in hex
  assert.equal(log.logIndex, '0x0');
  assert.equal(log.transactionIndex, '0x0');
  assert.equal(log.removed, false);
  assert.equal(log.transactionHash, TX_A);
});

test('buildPayloadBodies wraps blocks in data and splits under the byte limit without losing logs', () => {
  const logs = [];
  for (let block = 1; block <= 6; block++) logs.push(rawLog({ block, txIndex: 0, logIndex: 0, data: `0x${'ff'.repeat(200)}` }));
  const timestamps = new Map(logs.map((_, i) => [BigInt(i + 1), 1000n]));
  const entries = buildLogEntries(groupLogsByBlockAndReceipt(logs), timestamps);
  const limit = 1200;
  const bodies = buildPayloadBodies(entries, limit);
  assert.ok(bodies.length > 1, 'expected a split');
  let total = 0;
  for (const body of bodies) {
    assert.ok(Buffer.byteLength(body) <= limit);
    const parsed = JSON.parse(body);
    for (const block of parsed.data) for (const receipt of block) total += receipt.length;
  }
  assert.equal(total, 6);
  assert.equal(JSON.parse(buildPayloadBodies(entries)[0]).data.length, 6);
  assert.throws(() => buildPayloadBodies(entries, 100), /alone exceeds/);
});

test('signQuickNodeRequest matches an independent HMAC over nonce + timestamp + raw body', () => {
  const secret = 'test-replay-secret';
  const nonce = 'nonce-1234';
  const timestamp = '1800000000';
  const body = '{"data":[[[{"a":1}]]]}';
  // Independent computation of the documented scheme: HMAC-SHA256, hex, over nonce + timestamp + body.
  const expected = createHmac('sha256', secret).update(`${nonce}${timestamp}${body}`, 'utf8').digest('hex');
  const headers = signQuickNodeRequest({ secret, body, nonce, timestamp });
  assert.equal(headers['X-QN-Nonce'], nonce);
  assert.equal(headers['X-QN-Timestamp'], timestamp);
  assert.equal(headers['X-QN-Signature'], expected);
  assert.match(expected, /^[0-9a-f]{64}$/);
  assert.equal(headers['Content-Type'], 'application/json');
  // Any change to the body, nonce or timestamp changes the signature.
  assert.notEqual(signQuickNodeRequest({ secret, body: body + ' ', nonce, timestamp })['X-QN-Signature'], expected);
  assert.notEqual(signQuickNodeRequest({ secret, body, nonce, timestamp: '1800000001' })['X-QN-Signature'], expected);
});
