import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import {
  buildFilterSource,
  encodeFilter,
  parseArgs,
  streamConfig,
  upsertEnvLine,
  validateWebhookUrl,
} from './quicknode-stream.mjs';

const POT = '0xf842F699128A2e575d20BcC92F0472C7ad59e5C8';
const OTHER = '0x3600000000000000000000000000000000000000';

function runFilter(stream) {
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(`${buildFilterSource(POT)}\nthis.result = main(${JSON.stringify(stream)});`, sandbox);
  return sandbox.result;
}

const log = (address, logIndex) => ({ address, topics: ['0xabc'], data: '0x', logIndex, blockNumber: '0x1', transactionHash: '0xdead' });

test('filter keeps only the Pot contract logs, flattened, from data[block][receipt][log]', () => {
  const out = runFilter({
    data: [
      [[log(OTHER, '0x0'), log(POT, '0x1')], [log(POT.toLowerCase(), '0x2')]],
      [[log(OTHER, '0x3')]],
    ],
  });
  assert.equal(out.length, 2);
  // spread into a main-realm array: arrays created inside the vm sandbox have a different prototype
  assert.deepEqual([...out.map(l => l.logIndex)], ['0x1', '0x2']);
});

test('filter matches the address case-insensitively', () => {
  assert.equal(runFilter({ data: [[[log(POT.toUpperCase().replace('0X', '0x'), '0x0')]]] }).length, 1);
});

test('filter returns null (skip delivery) when no Pot logs are present', () => {
  assert.equal(runFilter({ data: [[[log(OTHER, '0x0')]], [[]], []] }), null);
  assert.equal(runFilter({ data: [] }), null);
});

test('buildFilterSource rejects a missing or invalid address', () => {
  assert.throws(() => buildFilterSource(undefined), /POT_ADDRESS/);
  assert.throws(() => buildFilterSource('0x123'), /POT_ADDRESS/);
});

test('encodeFilter is base64 of the source', () => {
  const src = buildFilterSource(POT);
  assert.equal(Buffer.from(encodeFilter(src), 'base64').toString('utf8'), src);
});

test('validateWebhookUrl accepts the public route and rejects the rest', () => {
  assert.equal(validateWebhookUrl('https://pot.vercel.app/api/streams'), 'https://pot.vercel.app/api/streams');
  assert.equal(validateWebhookUrl('https://pot.vercel.app/api/streams/'), 'https://pot.vercel.app/api/streams/');
  assert.throws(() => validateWebhookUrl('http://pot.vercel.app/api/streams'), /https/);
  assert.throws(() => validateWebhookUrl('https://localhost:3000/api/streams'), /public/);
  assert.throws(() => validateWebhookUrl('https://192.168.1.5/api/streams'), /public/);
  assert.throws(() => validateWebhookUrl('https://pot.vercel.app/api/other'), /api\/streams/);
  assert.throws(() => validateWebhookUrl('not a url'), /Invalid/);
});

test('parseArgs reads the command and flags', () => {
  const a = parseArgs(['create', '--url', 'https://x.app/api/streams', '--name', 'n', '--yes', '--no-write-env']);
  assert.deepEqual(
    { c: a.command, u: a.url, n: a.name, y: a.yes, w: a.writeEnv },
    { c: 'create', u: 'https://x.app/api/streams', n: 'n', y: true, w: false },
  );
  const d = parseArgs(['create']);
  assert.equal(d.name, 'pot-events');
  assert.equal(d.yes, false);
  assert.equal(d.writeEnv, true);
  assert.equal(parseArgs(['test', '--block', '72510574']).block, '72510574');
  assert.throws(() => parseArgs(['test', '--block', 'abc']), /block number/);
  assert.throws(() => parseArgs(['create', '--url']), /needs a value/);
  assert.throws(() => parseArgs(['create', '--bogus']), /Unknown argument/);
});

test('upsertEnvLine replaces an empty or filled line, or appends, without touching other lines', () => {
  assert.equal(upsertEnvLine('A=1\nQUICKNODE_STREAM_TOKEN=\nB=2\n', 'QUICKNODE_STREAM_TOKEN', 'tok'), 'A=1\nQUICKNODE_STREAM_TOKEN=tok\nB=2\n');
  assert.equal(upsertEnvLine('A=1\nQUICKNODE_STREAM_TOKEN=old\n', 'QUICKNODE_STREAM_TOKEN', 'new'), 'A=1\nQUICKNODE_STREAM_TOKEN=new\n');
  assert.equal(upsertEnvLine('A=1\n', 'QUICKNODE_STREAM_TOKEN', 'tok'), 'A=1\nQUICKNODE_STREAM_TOKEN=tok\n');
  assert.equal(upsertEnvLine('A=1', 'QUICKNODE_STREAM_TOKEN', 'tok'), 'A=1\nQUICKNODE_STREAM_TOKEN=tok\n');
  assert.equal(upsertEnvLine('', 'QUICKNODE_STREAM_TOKEN', 'tok'), 'QUICKNODE_STREAM_TOKEN=tok\n');
  // a "$" in the token must not be treated as a replacement pattern
  assert.equal(upsertEnvLine('QUICKNODE_STREAM_TOKEN=\n', 'QUICKNODE_STREAM_TOKEN', 'a$&b'), 'QUICKNODE_STREAM_TOKEN=a$&b\n');
});

test('streamConfig targets Arc testnet logs with a webhook and a tip-safe batch size', () => {
  const cfg = streamConfig({ name: 'pot-events', url: 'https://x.app/api/streams', filterSource: buildFilterSource(POT) });
  assert.equal(cfg.network, 'arc-testnet');
  assert.equal(cfg.dataset, 'logs');
  assert.equal(cfg.destination, 'webhook');
  assert.equal(cfg.destination_attributes.url, 'https://x.app/api/streams');
  assert.equal(cfg.destination_attributes.compression, 'none');
  assert.ok(cfg.dataset_batch_size >= 5);
  assert.equal(cfg.elastic_batch_enabled, true);
  assert.equal(cfg.start_range, undefined);
  assert.equal(cfg.status, 'active');
});
