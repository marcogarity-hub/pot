#!/usr/bin/env node
// QuickNode Stream setup for Pot: tests the filter against a real block, creates the Stream, and lists it.
//
// Usage:
//   node scripts/quicknode-stream.mjs test   [--block 72510574]
//   node scripts/quicknode-stream.mjs create --url https://<app>/api/streams [--name pot-events] [--yes] [--no-write-env]
//   node scripts/quicknode-stream.mjs status
//
// `create` is a dry run unless --yes is passed. On --yes it creates the Stream, reads back the
// auto-generated security token, and saves it as QUICKNODE_STREAM_TOKEN in web/.env.local.
// Neither the API key nor the token is ever printed.
// Tests: node --test scripts/*.test.mjs (Node 24 needs the glob, not the bare folder).

import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const API = 'https://api.quicknode.com/streams/rest/v1';
const NETWORK = 'arc-testnet'; // slug from QuickNode's Streams OpenAPI spec
const DATASET = 'logs';
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const TOKEN_ENV = 'QUICKNODE_STREAM_TOKEN';
// Arc blocks arrive faster than one a second; QuickNode requires a batch size of at least 5 for
// Streams that follow the chain tip on such networks, and recommends elastic batching.
const BATCH_SIZE = 5;
const USAGE =
  'Usage: node scripts/quicknode-stream.mjs test [--block N] | create --url https://<app>/api/streams [--name pot-events] [--yes] [--no-write-env] | status';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..', 'web');
const requireFromWeb = createRequire(path.join(webDir, 'package.json'));

/** Source of the filter function that runs on QuickNode: keeps only the Pot contract's logs, else null (skip). */
export function buildFilterSource(potAddress) {
  if (!ADDRESS_RE.test(String(potAddress))) throw new Error('NEXT_PUBLIC_POT_ADDRESS is missing or not a valid 0x address');
  const pot = potAddress.toLowerCase();
  return [
    'function main(stream) {',
    `  const POT = ${JSON.stringify(pot)};`,
    '  const logs = [];',
    '  for (const block of stream.data) {',
    '    for (const receipt of block) {',
    '      for (const log of receipt) {',
    "        if (log && typeof log.address === 'string' && log.address.toLowerCase() === POT) logs.push(log);",
    '      }',
    '    }',
    '  }',
    '  return logs.length > 0 ? logs : null;',
    '}',
    '',
  ].join('\n');
}

export function encodeFilter(source) {
  return Buffer.from(source, 'utf8').toString('base64');
}

/** Accepts only a public https URL for our /api/streams route. */
export function validateWebhookUrl(input) {
  let url;
  try {
    url = new URL(String(input));
  } catch {
    throw new Error(`Invalid --url "${input}"`);
  }
  if (url.protocol !== 'https:') throw new Error('--url must be https (QuickNode needs a public address)');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || /^(127\.|10\.|192\.168\.)/.test(host)) {
    throw new Error('--url must be a public address, not localhost or a private network');
  }
  if (url.pathname.replace(/\/+$/, '') !== '/api/streams') throw new Error('--url must end with /api/streams');
  return url.toString();
}

export function parseArgs(argv) {
  const args = { command: undefined, block: undefined, url: undefined, name: 'pot-events', yes: false, writeEnv: true };
  const rest = [...argv];
  if (rest.length > 0 && !rest[0].startsWith('-')) args.command = rest.shift();
  for (let i = 0; i < rest.length; i++) {
    const flag = rest[i];
    const value = () => {
      const next = rest[i + 1];
      if (next === undefined || next.startsWith('--')) throw new Error(`${flag} needs a value`);
      i += 1;
      return next;
    };
    switch (flag) {
      case '--block':
        args.block = value();
        if (!/^\d+$/.test(args.block)) throw new Error('--block must be a block number');
        break;
      case '--url':
        args.url = value();
        break;
      case '--name':
        args.name = value();
        break;
      case '--yes':
        args.yes = true;
        break;
      case '--no-write-env':
        args.writeEnv = false;
        break;
      case '--help':
      case '-h':
        args.command = 'help';
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }
  return args;
}

/** Sets KEY=value in .env-style text: replaces an existing line (even an empty one) or appends. */
export function upsertEnvLine(text, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(text)) return text.replace(re, () => line);
  return `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${line}\n`;
}

export function streamConfig({ name, url, filterSource }) {
  return {
    name,
    network: NETWORK,
    dataset: DATASET,
    filter_function: encodeFilter(filterSource),
    region: 'usa_east',
    dataset_batch_size: BATCH_SIZE,
    elastic_batch_enabled: true,
    destination: 'webhook',
    destination_attributes: { url, compression: 'none', max_retry: 5, retry_interval_sec: 2, post_timeout_sec: 30 },
    status: 'active',
  };
}

function loadEnv() {
  requireFromWeb('@next/env').loadEnvConfig(webDir);
}

function redact(message) {
  let out = String(message);
  for (const key of ['QUICKNODE_API_KEY', TOKEN_ENV]) {
    const secret = process.env[key];
    if (secret) out = out.split(secret).join('[redacted]');
  }
  return out;
}

async function qn(method, route, body) {
  const apiKey = process.env.QUICKNODE_API_KEY;
  if (!apiKey) throw new Error('QUICKNODE_API_KEY is not set in web/.env.local');
  const response = await fetch(`${API}${route}`, {
    method,
    headers: { accept: 'application/json', 'content-type': 'application/json', 'x-api-key': apiKey },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text.slice(0, 300) };
  }
  return { status: response.status, json };
}

function describeError(res) {
  const msg = res.json?.error ?? res.json?.message ?? res.json?.raw ?? JSON.stringify(res.json).slice(0, 300);
  return `QuickNode API returned HTTP ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`;
}

async function cmdTest(args) {
  const filterSource = buildFilterSource(process.env.NEXT_PUBLIC_POT_ADDRESS);
  const block = args.block ?? '72510574';
  const res = await qn('POST', '/streams/test_filter', {
    network: NETWORK,
    dataset: DATASET,
    block,
    filter_function: encodeFilter(filterSource),
  });
  console.log(`test_filter on ${NETWORK} ${DATASET} block ${block}: HTTP ${res.status}`);
  if (res.status >= 300) throw new Error(describeError(res));
  const body = res.json;
  console.log(`response keys: ${Object.keys(body).join(', ')}`);
  const payload = body.result ?? body.data ?? body.payload ?? body;
  const logs = Array.isArray(payload) ? payload.flat(2) : Array.isArray(payload?.data) ? payload.data.flat(2) : [];
  console.log(`logs returned by the filter: ${logs.length}`);
  for (const log of logs) {
    const fields = ['address', 'topics', 'data', 'logIndex', 'blockNumber', 'transactionHash'];
    const missing = fields.filter(f => log?.[f] === undefined);
    console.log(
      `  ${String(log?.address).toLowerCase()} topics=${Array.isArray(log?.topics) ? log.topics.length : '?'} logIndex=${log?.logIndex} tx=${String(log?.transactionHash).slice(0, 12)}… ${missing.length ? `MISSING: ${missing.join(',')}` : 'fields ok'}`,
    );
  }
  if (logs.length === 0) console.log(`  (empty: ${JSON.stringify(body).slice(0, 300)})`);
}

async function cmdCreate(args) {
  if (!args.url) throw new Error('create needs --url https://<your-app>/api/streams');
  const url = validateWebhookUrl(args.url);
  const filterSource = buildFilterSource(process.env.NEXT_PUBLIC_POT_ADDRESS);
  const config = streamConfig({ name: args.name, url, filterSource });
  const existing = await qn('GET', '/streams?limit=100');
  if (existing.status >= 300) throw new Error(describeError(existing));
  const names = (existing.json.data ?? []).map(s => s.name);
  if (names.includes(args.name)) throw new Error(`A stream named "${args.name}" already exists. Pick another --name or delete it first.`);

  console.log('Stream plan:');
  console.log(`  name:        ${config.name}`);
  console.log(`  network:     ${config.network}   dataset: ${config.dataset}`);
  console.log(`  filter:      only logs from ${process.env.NEXT_PUBLIC_POT_ADDRESS.toLowerCase()}`);
  console.log(`  batch:       ${config.dataset_batch_size} blocks, elastic batching on, starts at the chain tip`);
  console.log(`  destination: webhook ${url}`);
  if (!args.yes) {
    console.log('DRY RUN: nothing created. Re-run with --yes to create the Stream.');
    return;
  }

  const created = await qn('POST', '/streams', config);
  if (created.status >= 300) throw new Error(describeError(created));
  const id = created.json.id;
  if (!id) throw new Error('QuickNode returned no stream id');
  console.log(`Created stream ${id} (status ${created.json.status ?? 'unknown'}).`);

  let token = created.json.destination_attributes?.security_token;
  if (!token) {
    const fetched = await qn('GET', `/streams/${id}`);
    if (fetched.status >= 300) throw new Error(describeError(fetched));
    token = fetched.json.destination_attributes?.security_token;
  }
  if (!token) throw new Error(`Stream ${id} was created but no security token was returned. Read it in the QuickNode dashboard.`);
  if (!args.writeEnv) {
    console.log('Security token received but NOT saved (--no-write-env). Read it from the QuickNode dashboard.');
    return;
  }
  const envPath = path.join(webDir, '.env.local');
  const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  fs.writeFileSync(envPath, upsertEnvLine(current, TOKEN_ENV, token));
  console.log(`Saved ${TOKEN_ENV} to web/.env.local (value not printed). Add the same variable to Vercel, then redeploy.`);
}

async function cmdStatus() {
  const res = await qn('GET', '/streams?limit=100');
  if (res.status >= 300) throw new Error(describeError(res));
  const streams = res.json.data ?? [];
  console.log(`${streams.length} stream(s)`);
  for (const s of streams) {
    console.log(`  ${s.name}  id=${s.id}  ${s.network}/${s.dataset}  status=${s.status}  sequence=${s.sequence ?? 'n/a'}  -> ${s.destination_attributes?.url ?? ''}`);
  }
}

export async function run(argv) {
  try {
    const args = parseArgs(argv);
    if (!args.command || args.command === 'help') {
      console.log(USAGE);
      return args.command === 'help' ? 0 : 1;
    }
    loadEnv();
    if (args.command === 'test') await cmdTest(args);
    else if (args.command === 'create') await cmdCreate(args);
    else if (args.command === 'status') await cmdStatus();
    else throw new Error(`Unknown command: ${args.command}`);
    return 0;
  } catch (error) {
    console.error(`Error: ${redact(error instanceof Error ? error.message : error)}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  });
}
