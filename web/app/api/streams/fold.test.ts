import { describe, it, expect } from 'vitest';
import { decodePotLogs } from './decode';
import { foldPot } from './fold';
import { abi, address, alice, bob, created, event, paidLog, receipt } from './test-support';

describe('foldPot', () => {
  it('creates exact rows and applies Paid, Locked, PayoutRequested and Released', () => {
    const initial = foldPot([created]);
    expect(initial.pot).toMatchObject({ pot_id: '1', organizer_address: alice, total: created.args.total, share: created.args.share, state: 0, payments_count: 0, threshold: 2, objection_window_seconds: 120, request_window_seconds: 600, deadline: new Date(1800000000000).toISOString() });
    expect(initial.members).toHaveLength(2);
    expect(initial.members[0]).toMatchObject({ active: true, has_paid: false, has_objected: false, has_refunded: false });
    const events = [created, event('Paid', { member: alice }, 1), event('Paid', { member: bob }, 2), event('Locked', { lockedAt: '1799990000' }, 3), event('PayoutRequested', { receiptHash: receipt, releaseEligibleAt: '1799990120' }, 4)];
    const locked = foldPot(events);
    expect(locked.pot).toMatchObject({ payments_count: 2, state: 2, locked_at: new Date(1799990000000).toISOString(), receipt_hash: receipt, release_eligible_at: new Date(1799990120000).toISOString() });
    expect(foldPot([...events, event('Released', {}, 5)]).pot.state).toBe(3);
    expect(foldPot([...events].reverse().concat(events))).toEqual(locked);
  });
  it('keeps payment history on paid seat swaps and refunds; replacement restores count', () => {
    const replacement = '0xcccccccccccccccccccccccccccccccccccccccc';
    const swapped = [created, event('Paid', { member: alice }, 1), event('SeatSwapped', { leaver: alice, replacement, refunded: '300000000000000000000' }, 2)];
    expect(foldPot(swapped).pot.payments_count).toBe(0);
    const result = foldPot([...swapped, event('Paid', { member: replacement }, 3), event('Refunded', { member: replacement }, 4)]);
    expect(result.pot.payments_count).toBe(1);
    expect(result.members.find(m => m.address === alice)).toMatchObject({ active: false, has_paid: true, has_refunded: true });
    expect(result.members.find(m => m.address === replacement)).toMatchObject({ active: true, has_paid: true, has_refunded: true });
    expect(foldPot([created, event('SeatSwapped', { leaver: alice, replacement, refunded: '0' }, 1)]).members[0].has_refunded).toBe(false);
  });
  it('folds five objections and Frozen, and Expired', () => {
    const members = Array.from({ length: 5 }, (_, i) => `0x${String(i + 1).padStart(40, '0')}`);
    const result = foldPot([{ ...created, args: { ...created.args, members } }, ...members.map((member, i) => event('Objected', { member, objectionsCount: String(i + 1) }, i + 1)), event('Frozen', {}, 6)]);
    expect(result.pot).toMatchObject({ objections_count: 5, state: 4 });
    expect(result.members.every(m => m.has_objected)).toBe(true);
    expect(foldPot([created, event('Expired', {}, 1)]).pot.state).toBe(4);
  });
  it('orders block numbers without rounding and normalizes deduplication keys', () => {
    const paid = { ...event('Paid', { member: alice.toUpperCase() }, 1), blockNumber: '9007199254740994', txHash: '0xAB' };
    expect(foldPot([paid, created, { ...paid, txHash: '0xab' }]).pot.payments_count).toBe(1);
  });
});
describe('decodePotLogs', () => {
  it('decodes nested docs-shaped logs, preserves bigints, ignores other addresses', () => {
    const log = paidLog();
    const decoded = decodePotLogs({ data: [[[log, { ...log, address: bob }]]] }, abi, address);
    expect(decoded).toEqual([event('Paid', { member: alice, amount: '300000000000000000000' }, 1)]);
  });
  it('rejects malformed matching logs and removed logs instead of silently losing events', () => {
    expect(() => decodePotLogs({ data: [[[{ ...paidLog(), data: '0x' }]]] }, abi, address)).toThrow();
    expect(() => decodePotLogs({ data: [[[{ ...paidLog(), removed: true }]]] }, abi, address)).toThrow();
    expect(() => decodePotLogs({}, abi, address)).toThrow();
  });
});

describe('deployed ABI fixture', () => {
  it('decodes and folds every contract event, including expiry without Frozen', async () => {
    const { default: fixture } = await import('./__fixtures__/arc-logs.json');
    const events = decodePotLogs(fixture, abi, address);
    expect([...new Set(events.map(e => e.name))].sort()).toEqual(
      abi.filter(e => e.type === 'event').map(e => e.name).sort(),
    );
    expect(events).toHaveLength(22);
    expect(events[0].args).toEqual({ potId: '1', organizer: alice, members: [alice, bob],
      total: '600000000000000000000', share: '300000000000000000000', deadline: '1800000000',
      threshold: '1', objectionWindow: '120', requestWindow: '600' });
    const project = (id: string) => foldPot(events.filter(e => e.potId === id));
    const released = project('1');
    expect(released.pot).toMatchObject({ state: 3, payments_count: 2,
      locked_at: new Date(1799990000000).toISOString(), receipt_hash: receipt,
      release_eligible_at: new Date(1799990120000).toISOString() });
    expect(released.members.find(m => m.address === alice)).toMatchObject({ active: false, has_paid: true, has_refunded: true });
    expect(released.members.find(m => m.address === '0xcccccccccccccccccccccccccccccccccccccccc')).toMatchObject({ active: true, has_paid: true, has_refunded: false });
    const frozen = project('2');
    expect(frozen.pot).toMatchObject({ state: 4, objections_count: 1, payments_count: 2 });
    expect(frozen.members.find(m => m.address === alice)).toMatchObject({ has_paid: true, has_objected: true, has_refunded: true });
    expect(events.filter(e => e.potId === '3').map(e => e.name)).not.toContain('Frozen');
    expect(project('3').pot).toMatchObject({ state: 4, payments_count: 2 });
    expect(project('3').members.find(m => m.address === bob)).toMatchObject({ has_paid: true, has_refunded: true });
  });
});
