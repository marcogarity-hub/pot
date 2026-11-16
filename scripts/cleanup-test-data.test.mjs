import assert from 'node:assert/strict';
import test from 'node:test';
import { isTestEmail, parseArgs, planUsers } from './cleanup-test-data.mjs';

test('isTestEmail matches only the test domain or explicitly included addresses, case-insensitively', () => {
  assert.equal(isTestEmail('e2e-m1@pot-e2e.test'), true);
  assert.equal(isTestEmail('E2E-M1@POT-E2E.TEST'), true);
  assert.equal(isTestEmail('someone@gmail.com'), false);
  assert.equal(isTestEmail('x@pot-e2e.test.evil.com'), false);
  assert.equal(isTestEmail('pot-e2e.test'), false);
  assert.equal(isTestEmail(null), false);
  assert.equal(isTestEmail('me@example.com', ['Me@Example.com']), true);
  assert.equal(isTestEmail('other@example.com', ['me@example.com']), false);
});

test('planUsers splits doomed and kept without touching real addresses', () => {
  const plan = planUsers(['a@pot-e2e.test', 'real@gmail.com', 'b@pot-e2e.test', 'me@example.com'], ['me@example.com']);
  assert.deepEqual([...plan.doomed], ['a@pot-e2e.test', 'b@pot-e2e.test', 'me@example.com']);
  assert.deepEqual([...plan.kept], ['real@gmail.com']);
});

test('parseArgs reads pots, includes and flags; defaults are safe', () => {
  const d = parseArgs([]);
  assert.deepEqual({ p: d.pots, e: d.includeEmails, y: d.yes }, { p: [], e: [], y: false });
  const a = parseArgs(['--pots', '0, 1,3,1', '--include-email', 'x@y.z', '--include-email', 'q@r.s', '--yes']);
  assert.deepEqual([...a.pots], ['0', '1', '3']);
  assert.deepEqual([...a.includeEmails], ['x@y.z', 'q@r.s']);
  assert.equal(a.yes, true);
});

test('parseArgs rejects bad input', () => {
  assert.throws(() => parseArgs(['--pots']), /needs a value/);
  assert.throws(() => parseArgs(['--pots', '1,two']), /Invalid pot id/);
  assert.throws(() => parseArgs(['--pots', '-1']), /needs a value|Invalid pot id/);
  assert.throws(() => parseArgs(['--all']), /Unknown argument/);
});
