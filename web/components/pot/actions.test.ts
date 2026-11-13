import { describe, expect, it } from 'vitest';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { availableActions } from './actions';

const ORG = '0x00000000000000000000000000000000000000aa';
const A = '0x00000000000000000000000000000000000000a1';
const B = '0x00000000000000000000000000000000000000b2';
const STRANGER = '0x00000000000000000000000000000000000000ff';
const T0 = '2026-11-14T12:00:00.000Z';
const at = (offsetSec: number) => new Date(Date.parse(T0) + offsetSec * 1000);

type Member = PotStatusRow['members'][number];
const member = (address: string, over: Partial<Member> = {}): Member => ({
  address, email: null, has_paid: false, has_objected: false, has_refunded: false, active: true, is_organizer: false, ...over,
});
const pot = (over: Partial<PotStatusRow> = {}): PotStatusRow => ({
  pot_id: '1', organizer_address: ORG, total: '200', share: '100', deadline: T0, threshold: 1,
  objection_window_seconds: 120, request_window_seconds: 120, locked_at: null, state: 0,
  payments_count: 0, objections_count: 0, receipt_hash: null, release_eligible_at: null,
  updated_at: T0, title: 'Trip', invite_token: 'tok', receipt_text: null, created_at: T0, is_organizer: null,
  members: [member(A), member(B)], ...over,
});

describe('availableActions', () => {
  it('Funding, unpaid member before the deadline → pay', () => {
    expect(availableActions(pot(), A, at(-1))).toEqual(['pay']);
  });

  it('Funding, organizer gets swap; an unpaid organizer-member gets pay and swap', () => {
    expect(availableActions(pot(), ORG, at(-1))).toEqual(['swap']);
    const withOrg = pot({ members: [member(ORG, { is_organizer: true }), member(A)] });
    expect(availableActions(withOrg, ORG, at(-1))).toEqual(['pay', 'swap']);
  });

  it('matches addresses case-insensitively', () => {
    expect(availableActions(pot(), A.toUpperCase().replace('0X', '0x'), at(-1))).toEqual(['pay']);
  });

  it('Funding, paid member before the deadline → nothing', () => {
    expect(availableActions(pot({ members: [member(A, { has_paid: true }), member(B)] }), A, at(-1))).toEqual([]);
  });

  it('Funding at/after the deadline, paid and not refunded → refund (no pay, no swap)', () => {
    const s = pot({ members: [member(A, { has_paid: true }), member(B)] });
    expect(availableActions(s, A, at(0))).toEqual(['refund']);
    expect(availableActions(s, B, at(0))).toEqual([]);
    expect(availableActions(s, ORG, at(0))).toEqual([]);
    const refunded = pot({ members: [member(A, { has_paid: true, has_refunded: true }), member(B)] });
    expect(availableActions(refunded, A, at(10))).toEqual([]);
  });

  it('a former (inactive) member gets nothing', () => {
    expect(availableActions(pot({ members: [member(A, { active: false }), member(B)] }), A, at(-1))).toEqual([]);
  });

  it('signed-out or stranger in Funding → nothing', () => {
    expect(availableActions(pot(), null, at(-1))).toEqual([]);
    expect(availableActions(pot(), STRANGER, at(-1))).toEqual([]);
  });

  const locked = (over: Partial<PotStatusRow> = {}) => pot({
    state: 1, locked_at: T0, payments_count: 2,
    members: [member(A, { has_paid: true }), member(B, { has_paid: true })], ...over,
  });

  it('Locked + organizer → requestRelease', () => {
    expect(availableActions(locked(), ORG, at(10))).toEqual(['requestRelease']);
    expect(availableActions(locked(), A, at(10))).toEqual([]);
  });

  it('Locked past locked_at + request_window → expire for anyone signed in', () => {
    expect(availableActions(locked(), A, at(119))).toEqual([]);
    expect(availableActions(locked(), A, at(120))).toEqual(['expire']);
    expect(availableActions(locked(), STRANGER, at(120))).toEqual(['expire']);
    expect(availableActions(locked(), ORG, at(120))).toEqual(['requestRelease', 'expire']);
  });

  const requested = (over: Partial<PotStatusRow> = {}) => locked({
    state: 2, receipt_hash: '0x01', release_eligible_at: T0, ...over,
  });

  it('PayoutRequested before release_eligible_at, not yet objected → object', () => {
    expect(availableActions(requested(), A, at(-1))).toEqual(['object']);
    expect(availableActions(requested(), ORG, at(-1))).toEqual([]);
    const objected = requested({ members: [member(A, { has_paid: true, has_objected: true }), member(B, { has_paid: true })] });
    expect(availableActions(objected, A, at(-1))).toEqual([]);
  });

  it('PayoutRequested at/after release_eligible_at, below threshold → finalize for anyone', () => {
    expect(availableActions(requested(), A, at(0))).toEqual(['finalize']);
    expect(availableActions(requested(), null, at(0))).toEqual(['finalize']);
    expect(availableActions(requested({ threshold: 2, objections_count: 1 }), ORG, at(5))).toEqual(['finalize']);
    expect(availableActions(requested({ threshold: 1, objections_count: 1 }), A, at(5))).toEqual([]);
  });

  it('Frozen, paid, not refunded, active → refund, objectors included', () => {
    const frozen = pot({
      state: 4, members: [member(A, { has_paid: true, has_objected: true }), member(B, { has_paid: true, has_refunded: true })],
    });
    expect(availableActions(frozen, A, at(-100))).toEqual(['refund']);
    expect(availableActions(frozen, B, at(-100))).toEqual([]);
    expect(availableActions(frozen, ORG, at(-100))).toEqual([]);
  });

  it('Released → nothing', () => {
    expect(availableActions(locked({ state: 3 }), ORG, at(1000))).toEqual([]);
    expect(availableActions(locked({ state: 3 }), A, at(1000))).toEqual([]);
  });
});

describe('verifiedReceipt (A12)', () => {
  it('returns the text only when its keccak256 matches the on-chain hash', async () => {
    const { keccak256, toBytes } = await import('viem');
    const { verifiedReceipt } = await import('./actions');
    const text = 'Airbnb conf HMX123';
    const hash = keccak256(toBytes(text));
    expect(verifiedReceipt(text, hash)).toBe(text);
    expect(verifiedReceipt(text, hash.toUpperCase().replace('0X', '0x'))).toBe(text);
    expect(verifiedReceipt('tampered', hash)).toBeNull();
    expect(verifiedReceipt(null, hash)).toBeNull();
    expect(verifiedReceipt(text, null)).toBeNull();
  });
});
