#!/usr/bin/env node
// Backfill / replay tool: reads Pot contract logs from Arc testnet with eth_getLogs and POSTs them
// to /api/streams in the QuickNode EVM Logs shape (data[block][receipt][log]), signed exactly as
// web/app/api/streams/verify.ts verifies it: HMAC-SHA256 hex over nonce + timestamp + raw body,
// sent in X-QN-Nonce / X-QN-Timestamp / X-QN-Signature. Events are idempotent (tx hash + log index),
// so replaying a range that was already delivered is safe.
//
// Usage: node scripts/replay-stream.mjs [--url http://localhost:3000/api/streams] [--from-block N]
//          [--to-block N|latest] [--batch-blocks 2000] [--dry-run]
//
// Defaults: --from-block = POT_DEPLOY_BLOCK, --to-block = latest, --url = local dev server.
// Reads web/.env.local (existing process env wins). Never prints env values, the token or the signature.
//
// Tests: node --test scripts/*.test.mjs (Node 24 needs the glob, not the bare folder).

import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const RPC_URL = 'https://rpc.testnet.arc.io';
const DEFAULT_URL = 'http://localhost:3000/api/streams';
const DEFAULT_BATCH_BLOCKS = 2000;
// The handler rejects bodies over 5 MiB (decoded size). Stay well under it.
const MAX_BODY_BYTES = 4 * 1024 * 1024;
const RPC_TIMEOUT_MS = 30000;
const POST_TIMEOUT_MS = 60000;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const USAGE =
  'Usage: node scripts/replay-stream.mjs [--url http://localhost:3000/api/streams] [--from-block N] [--to-block N|latest] [--batch-blocks 2000] [--dry-run]';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..', 'web');
// Resolve packages from web/node_modules, the same place the Next.js app uses them.
const requireFromWeb = createRequire(path.join(webDir, 'package.json'));

export class RpcError extends Error {
  constructor(method, detail, status) {
    super(`Arc RPC ${method} failed: ${detail}`);
    this.name = 'RpcError';
    this.status = status;
  }
}

const RATE_LIMIT_RETRIES = 5;
const RATE_LIMIT_BASE_MS = 2000;

function parseNonNegativeInteger(value, flag) {
  if (!/^\d+$/.test(value)) throw new Error(`${flag} must be a non-negative integer or "latest"`);
  return BigInt(value);
}

/** Parses the argument list. Accepts --flag value and --flag=value. */
export function parseArgs(argv) {
  const args = {
    url: DEFAULT_URL,
    fromBlock: undefined, // bigint, or undefined to use POT_DEPLOY_BLOCK
    toBlock: 'latest', // bigint or 'latest'
    batchBlocks: DEFAULT_BATCH_BLOCKS,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const eq = token.startsWith('--') ? token.indexOf('=') : -1;
    const flag = eq === -1 ? token : token.slice(0, eq);
    const inline = eq === -1 ? undefined : token.slice(eq + 1);
    const value = () => {
      if (inline !== undefined) return inline;
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${flag} needs a value`);
      i += 1;
      return next;
    };
    switch (flag) {
      case '--url': {
        const raw = value();
        let parsed;
        try {
          parsed = new URL(raw);
        } catch {
          throw new Error('--url must be an absolute http(s) URL');
        }
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('--url must be an http(s) URL');
        args.url = raw;
        break;
      }
      case '--from-block':
        args.fromBlock = parseNonNegativeInteger(value(), '--from-block');
        break;
      case '--to-block': {
        const raw = value();
        args.toBlock = raw === 'latest' ? 'latest' : parseNonNegativeInteger(raw, '--to-block');
        break;
      }
      case '--batch-blocks': {
        const raw = value();
        if (!/^\d+$/.test(raw) || Number(raw) < 1) throw new Error('--batch-blocks must be a positive integer');
        args.batchBlocks = Number(raw);
        break;
      }
      case '--dry-run':
        if (inline !== undefined) throw new Error('--dry-run takes no value');
        args.dryRun = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return args;
}

/** Halves a block-range batch size, never below 1. */
export function halveBatchSize(size) {
  if (!Number.isInteger(size) || size < 1) throw new Error('batch size must be a positive integer');
  return Math.max(1, Math.floor(size / 2));
}

/**
 * Walks [from, to] in batches of batchBlocks. getLogs(from, to) returns the logs for that range.
 * When the RPC rejects a range (RpcError), the batch is halved and the same cursor retried; a
 * rejection at size 1 is fatal. onBatch({ from, to, logs }) runs after each successful range.
 * Returns the final batch size (reduced after any rejection).
 */
export async function scanBlocks({ from, to, batchBlocks, getLogs, onBatch, pauseMs = 0, sleep = ms => new Promise(r => setTimeout(r, ms)) }) {
  let size = batchBlocks;
  let cursor = from;
  let rateLimitHits = 0;
  while (cursor <= to) {
    const end = cursor + BigInt(size) - 1n > to ? to : cursor + BigInt(size) - 1n;
    let logs;
    try {
      logs = await getLogs(cursor, end);
    } catch (error) {
      if (!(error instanceof RpcError)) throw error;
      // 429 is throttling, not a range rejection: back off and retry the same range at the same size.
      if (error.status === 429) {
        rateLimitHits += 1;
        if (rateLimitHits > RATE_LIMIT_RETRIES) throw error;
        await sleep(RATE_LIMIT_BASE_MS * 2 ** (rateLimitHits - 1));
        continue;
      }
      if (size === 1) throw error;
      size = halveBatchSize(size);
      continue;
    }
    rateLimitHits = 0;
    await onBatch({ from: cursor, to: end, logs });
    cursor = end + 1n;
    if (pauseMs > 0 && cursor <= to) await sleep(pauseMs);
  }
  return size;
}

const toHex = value => `0x${BigInt(value).toString(16)}`;
const fromHex = value => BigInt(String(value));

/**
 * Groups eth_getLogs results into the QuickNode nesting data[block][receipt][log]: blocks ascending,
 * receipts (transactions) by transactionIndex ascending, logs by logIndex ascending.
 * Returns [{ blockNumber: bigint, receipts: [[log, ...], ...] }].
 */
export function groupLogsByBlockAndReceipt(logs) {
  const blocks = new Map();
  for (const log of logs) {
    const blockNumber = fromHex(log.blockNumber);
    const receiptIndex = fromHex(log.transactionIndex);
    if (!blocks.has(blockNumber)) blocks.set(blockNumber, new Map());
    const receipts = blocks.get(blockNumber);
    if (!receipts.has(receiptIndex)) receipts.set(receiptIndex, []);
    receipts.get(receiptIndex).push(log);
  }
  const byNumber = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...blocks.keys()].sort(byNumber).map(blockNumber => {
    const receipts = blocks.get(blockNumber);
    const ordered = [...receipts.keys()].sort(byNumber).map(index =>
      receipts.get(index).slice().sort((a, b) => byNumber(fromHex(a.logIndex), fromHex(b.logIndex))),
    );
    return { blockNumber, receipts: ordered };
  });
}

/**
 * Converts grouped logs into QuickNode-shaped log objects. timestamps maps block number (bigint)
 * to its block timestamp (bigint seconds). Fields are the RPC's own hex strings, unchanged.
 */
export function buildLogEntries(grouped, timestamps) {
  return grouped.map(({ blockNumber, receipts }) => ({
    blockNumber: toHex(blockNumber),
    receipts: receipts.map(logs =>
      logs.map(log => ({
        address: log.address,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        blockHash: log.blockHash,
        removed: log.removed ?? false,
        logIndex: log.logIndex,
        topics: log.topics,
        data: log.data,
        blockTimestamp: toHex(timestamps.get(blockNumber)),
      })),
    ),
  }));
}

/**
 * Builds request bodies ({ data: [block][receipt][log] }) each at most maxBytes of UTF-8 JSON.
 * Blocks are never split; a single block over the limit is an error.
 */
export function buildPayloadBodies(entries, maxBytes = MAX_BODY_BYTES) {
  const envelopeBytes = Buffer.byteLength('{"data":[]}');
  const bodies = [];
  let group = [];
  let groupBytes = envelopeBytes;
  for (const entry of entries) {
    const block = entry.receipts; // data[block] is the receipt array for that block
    const blockBytes = Buffer.byteLength(JSON.stringify(block)) + 1; // +1 for the comma
    if (envelopeBytes + blockBytes > maxBytes) {
      throw new Error(`Block ${BigInt(entry.blockNumber)} alone exceeds the ${maxBytes}-byte request limit`);
    }
    if (group.length && groupBytes + blockBytes > maxBytes) {
      bodies.push(JSON.stringify({ data: group }));
      group = [];
      groupBytes = envelopeBytes;
    }
    group.push(block);
    groupBytes += blockBytes;
  }
  if (group.length) bodies.push(JSON.stringify({ data: group }));
  return bodies;
}

/**
 * Signs exactly as web/app/api/streams/verify.ts: HMAC-SHA256 (hex) over nonce + timestamp + the
 * raw body string, which must be the exact bytes sent. Returns the headers to send.
 */
export function signQuickNodeRequest({ secret, body, nonce, timestamp }) {
  const signature = createHmac('sha256', secret).update(nonce + timestamp + body, 'utf8').digest('hex');
  return {
    'Content-Type': 'application/json',
    'X-QN-Nonce': nonce,
    'X-QN-Timestamp': timestamp,
    'X-QN-Signature': signature,
  };
}

function redact(message, secret) {
  return secret ? message.split(secret).join('[redacted]') : message;
}

async function rpcCall(method, params) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  let json;
  try {
    json = await response.json();
  } catch {
    json = undefined;
  }
  if (!response.ok) throw new RpcError(method, `HTTP ${response.status}`, response.status);
  if (!json || typeof json !== 'object') throw new RpcError(method, 'non-JSON response');
  if (json.error) throw new RpcError(method, String(json.error.message ?? 'unknown error').slice(0, 200));
  if (!('result' in json)) throw new RpcError(method, 'response has no result');
  return json.result;
}

function loadEnv() {
  requireFromWeb('@next/env').loadEnvConfig(webDir);
}

async function postBatch({ url, secret, body }) {
  const headers = signQuickNodeRequest({
    secret,
    body,
    nonce: randomUUID(),
    timestamp: String(Math.floor(Date.now() / 1000)),
  });
  const response = await fetch(url, { method: 'POST', headers, body, signal: AbortSignal.timeout(POST_TIMEOUT_MS) });
  let detail = '';
  try {
    const json = await response.json();
    if (json && typeof json.error === 'string') detail = json.error.slice(0, 120);
  } catch {
    // Non-JSON error bodies are not printed.
  }
  return { status: response.status, detail };
}

export async function run(argv) {
  let secret = '';
  try {
    const args = parseArgs(argv);
    if (args.help) {
      console.log(USAGE);
      return 0;
    }
    loadEnv();
    secret = (process.env.QUICKNODE_STREAM_TOKEN ?? '').trim();
    // A dry run sends nothing, so it can run without the token; signing is then skipped.
    if (!secret && !args.dryRun) {
      throw new Error('QUICKNODE_STREAM_TOKEN is empty; set it in web/.env.local or the environment. Nothing was sent.');
    }
    const potAddress = (process.env.NEXT_PUBLIC_POT_ADDRESS ?? '').trim();
    if (!ADDRESS_RE.test(potAddress) || potAddress.toLowerCase() === ZERO_ADDRESS) {
      throw new Error('NEXT_PUBLIC_POT_ADDRESS is missing or is not a valid non-zero 0x address');
    }
    let from = args.fromBlock;
    if (from === undefined) {
      const deploy = (process.env.POT_DEPLOY_BLOCK ?? '').trim();
      if (!/^\d+$/.test(deploy)) throw new Error('POT_DEPLOY_BLOCK is not set; pass --from-block N');
      from = BigInt(deploy);
    }
    const to = args.toBlock === 'latest' ? fromHex(await rpcCall('eth_blockNumber', [])) : args.toBlock;
    if (from > to) throw new Error(`--from-block (${from}) is after --to-block (${to}); nothing to replay`);

    console.log(`${args.dryRun ? 'Dry run' : 'Replay'}: blocks ${from} to ${to} (${to - from + 1n} blocks), batch ${args.batchBlocks}`);
    console.log(`Target: ${args.dryRun ? '(not contacted)' : args.url}`);

    const timestamps = new Map();
    const timestampOf = async blockNumber => {
      if (!timestamps.has(blockNumber)) {
        const block = await rpcCall('eth_getBlockByNumber', [toHex(blockNumber), false]);
        if (!block || typeof block.timestamp !== 'string') throw new RpcError('eth_getBlockByNumber', 'no block timestamp');
        timestamps.set(blockNumber, fromHex(block.timestamp));
      }
      return timestamps.get(blockNumber);
    };

    const stats = { blocksScanned: 0n, logsFound: 0, requests: 0, statuses: new Map(), failed: false };
    const onBatch = async ({ from: batchFrom, to: batchTo, logs }) => {
      stats.blocksScanned += batchTo - batchFrom + 1n;
      stats.logsFound += logs.length;
      if (!logs.length) return;
      const grouped = groupLogsByBlockAndReceipt(logs);
      for (const { blockNumber } of grouped) await timestampOf(blockNumber);
      const entries = buildLogEntries(grouped, timestamps);
      const bodies = buildPayloadBodies(entries);
      for (const body of bodies) {
        if (args.dryRun) {
          if (secret) signQuickNodeRequest({ secret, body, nonce: randomUUID(), timestamp: '0' });
          stats.requests += 1;
          console.log(`  would POST blocks ${batchFrom}-${batchTo}: ${logs.length} logs in batch, ${Buffer.byteLength(body)} bytes`);
          continue;
        }
        const { status, detail } = await postBatch({ url: args.url, secret, body });
        stats.requests += 1;
        stats.statuses.set(status, (stats.statuses.get(status) ?? 0) + 1);
        console.log(`  POST blocks ${batchFrom}-${batchTo}: HTTP ${status}${detail ? ` (${detail})` : ''}`);
        if (status < 200 || status > 299) {
          stats.failed = true;
          throw new Error(`HTTP ${status} from ${args.url}; stopping. Re-run the same range; delivery is idempotent.`);
        }
      }
    };

    try {
      await scanBlocks({
        from,
        to,
        batchBlocks: args.batchBlocks,
        getLogs: (start, end) =>
          rpcCall('eth_getLogs', [{ address: potAddress, fromBlock: toHex(start), toBlock: toHex(end) }]),
        onBatch,
        pauseMs: 250,
      });
    } finally {
      printSummary({ stats, dryRun: args.dryRun });
    }
    return stats.failed ? 1 : 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${redact(message, secret)}`);
    if (message.startsWith('Unknown argument') || message.includes('needs a value')) console.error(USAGE);
    return 1;
  }
}

function printSummary({ stats, dryRun }) {
  const statuses = [...stats.statuses].map(([status, count]) => `${status} x${count}`).join(', ') || 'none';
  console.log('Summary');
  console.log(`  blocks scanned: ${stats.blocksScanned}`);
  console.log(`  logs found:     ${stats.logsFound}`);
  console.log(dryRun ? `  requests that would be sent: ${stats.requests}` : `  requests sent: ${stats.requests}`);
  if (!dryRun) console.log(`  statuses seen: ${statuses}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  });
}
