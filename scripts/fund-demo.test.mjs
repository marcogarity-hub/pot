import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAmountToWei,
  parseArgs,
  validateAddresses,
  checkBudget,
  idempotencyKeyFor,
} from './fund-demo.mjs';

const ONE = BigInt(10) ** BigInt(18);
const TREASURY = '0x9f7402e58eb01dcaa221e0bdb413984595830c07';
const A = '0x1111111111111111111111111111111111111111';
const B = '0x2222222222222222222222222222222222222222';
const C = '0x3333333333333333333333333333333333333333';

test('parseAmountToWei parses valid decimals to 18-place wei', () => {
  assert.equal(parseAmountToWei('2'), BigInt(2) * ONE);
  assert.equal(parseAmountToWei('0.000001'), BigInt(10) ** BigInt(12));
  assert.equal(parseAmountToWei('0.5'), ONE / BigInt(2));
  assert.equal(parseAmountToWei('2.000000000000000001'), BigInt(2) * ONE + BigInt(1));
});

test('parseAmountToWei rejects zero, negatives, exponents, too many places, and empty input', () => {
  for (const bad of ['0', '0.0', '-1', '1e3', '2.0000000000000000001', '', '+2', '.5', 'abc']) {
    assert.throws(() => parseAmountToWei(bad), /Invalid amount|greater than 0/, `expected rejection of "${bad}"`);
  }
});

test('validateAddresses accepts a clean list', () => {
  assert.deepEqual(validateAddresses([A, B], TREASURY), [A, B]);
});

test('validateAddresses rejects bad hex and short addresses', () => {
  assert.throws(() => validateAddresses(['0xZZ'], TREASURY), /Invalid address/);
  assert.throws(() => validateAddresses(['0x' + '1'.repeat(39)], TREASURY), /Invalid address/);
  assert.throws(() => validateAddresses(['1111111111111111111111111111111111111111'], TREASURY), /Invalid address/);
});

test('validateAddresses rejects the zero address', () => {
  assert.throws(() => validateAddresses(['0x' + '0'.repeat(40)], TREASURY), /zero address/);
});

test('validateAddresses rejects duplicates regardless of case', () => {
  assert.throws(() => validateAddresses([A, A.toUpperCase().replace('0X', '0x')], TREASURY), /Duplicate/);
});

test('validateAddresses rejects the treasury as a recipient', () => {
  assert.throws(() => validateAddresses([A, TREASURY.toUpperCase().replace('0X', '0x')], TREASURY), /treasury/);
});

test('validateAddresses rejects an empty list', () => {
  assert.throws(() => validateAddresses([], TREASURY), /at least one --to/);
});

test('checkBudget passes within the 20 USDC hard cap with enough treasury balance', () => {
  assert.doesNotThrow(() =>
    checkBudget({ total: BigInt(6) * ONE, treasuryBalance: BigInt(10) * ONE, maxTotal: undefined }),
  );
});

test('checkBudget rejects a total over the hard cap', () => {
  assert.throws(
    () => checkBudget({ total: BigInt(21) * ONE, treasuryBalance: BigInt(100) * ONE, maxTotal: undefined }),
    /exceeds the cap of 20\.000000 USDC/,
  );
});

test('checkBudget allows a total over the hard cap when --max-total raises it', () => {
  assert.doesNotThrow(() =>
    checkBudget({ total: BigInt(21) * ONE, treasuryBalance: BigInt(100) * ONE, maxTotal: BigInt(25) * ONE }),
  );
  assert.throws(
    () => checkBudget({ total: BigInt(26) * ONE, treasuryBalance: BigInt(100) * ONE, maxTotal: BigInt(25) * ONE }),
    /exceeds the cap/,
  );
});

test('checkBudget requires the treasury to cover total plus 0.5 USDC gas reserve', () => {
  const total = BigInt(6) * ONE;
  assert.throws(
    () => checkBudget({ total, treasuryBalance: total + ONE / BigInt(2) - BigInt(1), maxTotal: undefined }),
    /gas reserve/,
  );
  assert.doesNotThrow(() => checkBudget({ total, treasuryBalance: total + ONE / BigInt(2), maxTotal: undefined }));
});

test('idempotencyKeyFor is a deterministic UUID that changes with recipient, amount and date', () => {
  const key = idempotencyKeyFor(A, ONE, '2026-11-15');
  assert.match(key, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(idempotencyKeyFor(A, ONE, '2026-11-15'), key);
  assert.notEqual(idempotencyKeyFor(B, ONE, '2026-11-15'), key);
  assert.notEqual(idempotencyKeyFor(A, BigInt(2) * ONE, '2026-11-15'), key);
  assert.notEqual(idempotencyKeyFor(A, ONE, '2026-11-16'), key);
});

test('parseArgs collects repeated --to in order', () => {
  const args = parseArgs(['--to', A, '--to', B, '--to', C]);
  assert.deepEqual(args.to, [A, B, C]);
});

test('parseArgs defaults amount to "2", dry run, no max-total', () => {
  const args = parseArgs(['--to', A]);
  assert.equal(args.amount, '2');
  assert.equal(args.yes, false);
  assert.equal(args.maxTotal, undefined);
  assert.equal(args.help, false);
});

test('parseArgs sets yes only with the --yes flag', () => {
  assert.equal(parseArgs(['--to', A, '--yes']).yes, true);
  assert.throws(() => parseArgs(['--to', A, '--yes=1']), /takes no value/);
});

test('parseArgs accepts inline --flag=value and --max-total', () => {
  const args = parseArgs(['--to', A, '--amount=0.5', '--max-total', '30']);
  assert.equal(args.amount, '0.5');
  assert.equal(args.maxTotal, '30');
});

test('parseArgs rejects a negative amount, a missing value, and unknown flags', () => {
  assert.throws(() => parseArgs(['--to', A, '--amount', '-1']), /Invalid amount/);
  assert.throws(() => parseArgs(['--to']), /needs a value/);
  assert.throws(() => parseArgs(['--to', A, '--bogus']), /Unknown argument/);
});

test('--run-id changes the idempotency key and defaults to empty', () => {
  assert.equal(parseArgs(['--to', A]).runId, '');
  assert.equal(parseArgs(['--to', A, '--run-id', 'rehearsal-2']).runId, 'rehearsal-2');
  const base = idempotencyKeyFor(A, ONE, '2026-11-15');
  assert.equal(idempotencyKeyFor(A, ONE, '2026-11-15', ''), base);
  assert.notEqual(idempotencyKeyFor(A, ONE, '2026-11-15', 'rehearsal-2'), base);
  assert.notEqual(
    idempotencyKeyFor(A, ONE, '2026-11-15', 'rehearsal-2'),
    idempotencyKeyFor(A, ONE, '2026-11-15', 'rehearsal-3'),
  );
  assert.throws(() => parseArgs(['--to', A, '--run-id']), /needs a value/);
});
