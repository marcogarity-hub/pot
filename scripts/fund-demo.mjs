#!/usr/bin/env node
// Demo funding (spec amendment A10): sends native testnet USDC from the Circle
// treasury to demo wallets before a live demo.
//
// Usage: node scripts/fund-demo.mjs --to 0xAddr [--to 0xAddr ...] [--amount 2] [--max-total <n>] [--run-id <text>] [--yes]
//
// Dry run unless --yes is passed. Re-running the same recipient and amount on the same UTC day is
// deduplicated by Circle (safe after a failure); to deliberately send again that day, pass a new
// --run-id. Never prints env values, API keys, entity secrets or wallet ids; only public
// addresses and balances are printed.
//
// Tests: node --test scripts/*.test.mjs (Node 24 needs the glob, not the bare folder).

import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DECIMALS = 18;
const ONE = BigInt(10) ** BigInt(DECIMALS);
const HARD_CAP = BigInt(20) * ONE;
const GAS_RESERVE = ONE / BigInt(2);
const MAX_FEE_FLOOR_WEI = BigInt('20000000000'); // 20 gwei, same floor as web/lib/relayer
const RPC_URL = 'https://rpc.testnet.arc.io';
const EXPLORER_TX = 'https://explorer.testnet.arc.io/tx/';
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const TERMINAL_FAILURES = new Set(['FAILED', 'CANCELLED', 'DENIED', 'STUCK']);
const POLL_MS = 3000;
const CONFIRM_TIMEOUT_MS = 120000;
const USAGE =
  'Usage: node scripts/fund-demo.mjs --to 0xAddr [--to 0xAddr ...] [--amount 2] [--max-total <n>] [--run-id <text>] [--yes]';

const here = path.dirname(fileURLToPath(import.meta.url));
const webDir = path.resolve(here, '..', 'web');
// Resolve packages from web/node_modules, the same place the Next.js app uses them.
const requireFromWeb = createRequire(path.join(webDir, 'package.json'));

/** Parses a positive decimal string into wei (18 places) using BigInt only. */
export function parseAmountToWei(input) {
  const match = /^(\d+)(?:\.(\d{1,18}))?$/.exec(String(input));
  if (!match) {
    throw new Error(`Invalid amount "${input}": use a positive decimal with at most ${DECIMALS} places, e.g. 2 or 0.5`);
  }
  const wei = BigInt(match[1]) * ONE + BigInt((match[2] ?? '').padEnd(DECIMALS, '0'));
  if (wei === BigInt(0)) throw new Error('Amount must be greater than 0');
  return wei;
}

/** Exact decimal string for Circle (e.g. 2e18 -> "2", 1e12 -> "0.000001"). */
export function toDecimalString(wei) {
  const whole = wei / ONE;
  const frac = (wei % ONE).toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : `${whole}`;
}

/** Display form with 6 decimals, truncated (not rounded). */
export function formatUsdc(wei) {
  const whole = wei / ONE;
  const frac = (wei % ONE).toString().padStart(DECIMALS, '0').slice(0, 6);
  return `${whole}.${frac} USDC`;
}

/** Parses a Circle gas value given in gwei (9 places), truncating extra digits. */
function gweiToWei(value) {
  const [whole, frac = ''] = String(value).split('.');
  return BigInt(whole || '0') * BigInt('1000000000') + BigInt((frac + '000000000').slice(0, 9));
}

/** Parses the argument list. Repeated --to accumulates; defaults amount to "2". */
export function parseArgs(argv) {
  const args = { to: [], amount: '2', maxTotal: undefined, runId: '', yes: false, help: false };
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
      case '--to':
        args.to.push(value());
        break;
      case '--amount':
        args.amount = value();
        break;
      case '--max-total':
        args.maxTotal = value();
        break;
      case '--run-id':
        args.runId = value();
        break;
      case '--yes':
        if (inline !== undefined) throw new Error('--yes takes no value');
        args.yes = true;
        break;
      case '--help':
      case '-h':
        args.help = true;
        break;
      default:
        throw new Error(`Unknown argument: ${flag}`);
    }
  }
  parseAmountToWei(args.amount);
  if (args.maxTotal !== undefined) parseAmountToWei(args.maxTotal);
  return args;
}

/** Throws on an empty list, bad hex, the zero address, duplicates, or the treasury as a recipient. */
export function validateAddresses(addresses, treasury) {
  if (!Array.isArray(addresses) || addresses.length === 0) throw new Error('Pass at least one --to <address>');
  const seen = new Set();
  const treasuryKey = treasury ? treasury.toLowerCase() : undefined;
  for (const address of addresses) {
    if (typeof address !== 'string' || !ADDRESS_RE.test(address)) {
      throw new Error(`Invalid address "${address}": expected 0x followed by 40 hex characters`);
    }
    const key = address.toLowerCase();
    if (key === ZERO_ADDRESS) throw new Error('The zero address is not a valid recipient');
    if (seen.has(key)) throw new Error(`Duplicate recipient address: ${address}`);
    if (key === treasuryKey) throw new Error(`Recipient equals the treasury address: ${address}`);
    seen.add(key);
  }
  return addresses;
}

/** Enforces the 20 USDC hard cap (or --max-total when given) and the treasury gas reserve. */
export function checkBudget({ total, treasuryBalance, maxTotal }) {
  const cap = maxTotal ?? HARD_CAP;
  if (total > cap) {
    const hint = maxTotal === undefined ? ' (pass --max-total <n> to raise the cap)' : '';
    throw new Error(`Total ${formatUsdc(total)} exceeds the cap of ${formatUsdc(cap)}${hint}`);
  }
  const required = total + GAS_RESERVE;
  if (treasuryBalance < required) {
    throw new Error(
      `Treasury balance ${formatUsdc(treasuryBalance)} does not cover the total plus 0.5 USDC gas reserve (${formatUsdc(required)} needed)`,
    );
  }
}

/** Deterministic UUID (v5 layout) derived from sha256 of recipient + amount + UTC date. */
export function idempotencyKeyFor(to, amountWei, utcDate, runId = '') {
  const hex = createHash('sha256')
    .update(`pot-demo-fund|${to.toLowerCase()}|${amountWei.toString()}|${utcDate}${runId ? `|${runId}` : ''}`)
    .digest('hex')
    .slice(0, 32);
  const variant = ((parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function getBalanceWei(address) {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_getBalance', params: [address, 'latest'] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Arc RPC returned HTTP ${response.status}`);
  const json = await response.json();
  if (json.error || typeof json.result !== 'string') {
    throw new Error(`Arc RPC eth_getBalance failed${json.error?.message ? `: ${json.error.message}` : ''}`);
  }
  return BigInt(json.result);
}

function loadEnv() {
  requireFromWeb('@next/env').loadEnvConfig(webDir);
}

function makeCircleClient() {
  const apiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  if (!apiKey || !entitySecret) throw new Error('Circle credentials unavailable (CIRCLE_API_KEY and CIRCLE_ENTITY_SECRET must be set)');
  const { initiateDeveloperControlledWalletsClient } = requireFromWeb('@circle-fin/developer-controlled-wallets');
  return initiateDeveloperControlledWalletsClient({ apiKey, entitySecret });
}

async function sendNative({ client, walletId, to, amountWei, idempotencyKey }) {
  // Native-token transfer shape from the 2026-11-13 Arc spike (tokenAddress "", blockchain ARC-TESTNET).
  const base = {
    walletId,
    tokenAddress: '',
    blockchain: 'ARC-TESTNET',
    destinationAddress: to,
    amount: [toDecimalString(amountWei)],
  };
  const estimate = (await client.estimateTransferFee(base)).data?.medium;
  if (!estimate?.gasLimit || !estimate.maxFee || !estimate.priorityFee) {
    throw new Error('Circle returned incomplete fee estimate');
  }
  const maxFee = gweiToWei(estimate.maxFee) < MAX_FEE_FLOOR_WEI ? '20' : estimate.maxFee;
  const submitted = await client.createTransaction({
    ...base,
    idempotencyKey,
    fee: { type: 'absolute', config: { gasLimit: estimate.gasLimit, maxFee, priorityFee: estimate.priorityFee } },
  });
  const id = submitted.data?.id;
  if (!id) throw new Error('Circle returned no transaction id');
  console.log(`  Circle transaction ${id} submitted; waiting for COMPLETE`);

  const deadline = Date.now() + CONFIRM_TIMEOUT_MS;
  let lastState;
  for (;;) {
    const tx = (await client.getTransaction({ id })).data?.transaction;
    const state = tx?.state;
    if (state && state !== lastState) console.log(`  state: ${state}`);
    lastState = state ?? lastState;
    if (state && TERMINAL_FAILURES.has(state)) {
      const reason = tx.errorReason ? `; errorReason: ${tx.errorReason}` : '';
      throw new Error(`Transaction ${id} ended ${state}${reason}. Stopping; reconcile before re-running`);
    }
    if (state === 'COMPLETE') {
      if (!tx.txHash || !/^0x[0-9a-fA-F]+$/.test(tx.txHash)) throw new Error(`Transaction ${id} is COMPLETE but has no hash`);
      return { id, txHash: tx.txHash };
    }
    if (Date.now() >= deadline) {
      throw new Error(`Timed out after 120 s waiting for transaction ${id} (last state ${lastState ?? 'unknown'}). Reconcile before re-running`);
    }
    await new Promise(resolve => setTimeout(resolve, POLL_MS));
  }
}

function redact(message) {
  let out = message;
  for (const key of ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET', 'CIRCLE_WALLET_SET_ID', 'CIRCLE_TREASURY_WALLET_ID']) {
    const secret = process.env[key];
    if (secret) out = out.split(secret).join('[redacted]');
  }
  return out;
}

export async function run(argv) {
  try {
    const args = parseArgs(argv);
    if (args.help) {
      console.log(USAGE);
      return 0;
    }
    loadEnv();
    const treasury = process.env.TREASURY_ADDRESS ?? '';
    if (!ADDRESS_RE.test(treasury)) throw new Error('TREASURY_ADDRESS is missing or is not a valid 0x address');
    validateAddresses(args.to, treasury);
    const amountWei = parseAmountToWei(args.amount);
    const maxTotal = args.maxTotal === undefined ? undefined : parseAmountToWei(args.maxTotal);
    const total = amountWei * BigInt(args.to.length);

    const treasuryBalance = await getBalanceWei(treasury);
    const recipients = [];
    for (const to of args.to) recipients.push({ to, balance: await getBalanceWei(to) });
    checkBudget({ total, treasuryBalance, maxTotal });

    const client = makeCircleClient();

    console.log(`Treasury:          ${treasury}`);
    console.log(`Treasury balance:  ${formatUsdc(treasuryBalance)}`);
    console.log('Recipients:');
    for (const r of recipients) console.log(`  ${r.to}  balance ${formatUsdc(r.balance)}`);
    console.log(`Amount each:       ${formatUsdc(amountWei)}`);
    console.log(`Total:             ${formatUsdc(total)}`);

    if (!args.yes) {
      console.log('DRY RUN: nothing sent. Re-run with --yes to send.');
      return 0;
    }

    const walletId = process.env.CIRCLE_TREASURY_WALLET_ID;
    if (!walletId) throw new Error('CIRCLE_TREASURY_WALLET_ID is not set');
    const utcDate = new Date().toISOString().slice(0, 10);
    for (const [index, to] of args.to.entries()) {
      const idempotencyKey = idempotencyKeyFor(to, amountWei, utcDate, args.runId);
      console.log(`Sending ${formatUsdc(amountWei)} to ${to} (${index + 1}/${args.to.length})`);
      const { txHash } = await sendNative({ client, walletId, to, amountWei, idempotencyKey });
      console.log(`  COMPLETE. Explorer: ${EXPLORER_TX}${txHash}`);
    }

    console.log('Balances after sending:');
    console.log(`  treasury  ${treasury}  ${formatUsdc(await getBalanceWei(treasury))}`);
    for (const r of recipients) {
      const after = await getBalanceWei(r.to);
      console.log(`  recipient ${r.to}  ${formatUsdc(after)}`);
      if (after - r.balance < amountWei) {
        console.log(
          '    NOTE: balance rose by less than the amount sent. If this wallet was already funded today, Circle may have returned the earlier transfer for the same key; pass --run-id <new text> to force a new one.',
        );
      }
    }
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Error: ${redact(message)}`);
    if (message.startsWith('Unknown argument') || message.includes('needs a value') || message.startsWith('Invalid amount')) {
      console.error(USAGE);
    }
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).then(code => {
    process.exitCode = code;
  });
}
