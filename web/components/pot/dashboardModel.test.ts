import { describe, expect, it } from 'vitest';
import { PotState } from '@/lib/pot/chain';
import {
  DASHBOARD_POT_COLUMNS,
  activityItems,
  heldAmount,
  needsYou,
  stateCounts,
  type ActivityEvent,
  type DashboardMember,
  type DashboardPot,
} from './dashboardModel';

const NOW = Date.parse('2026-11-16T12:00:00Z');
const HOUR = 3_600_000;
const iso = (t: number) => new Date(t).toISOString();

const ME = `0x${'a'.repeat(40)}`;
const OTHER = `0x${'b'.repeat(40)}`;
const ORG = `0x${'c'.repeat(40)}`;
const SHARE = '2000000000000000000'; // 2 USDC
const TOTAL = '6000000000000000000'; // 6 USDC

function member(address: string, over: Partial<DashboardMember> = {}): DashboardMember {
  return {
    address, email: null, name: null, has_paid: false, has_objected: false, has_refunded: false,
    active: true, is_organizer: false, ...over,
  };
}

function pot(over: Partial<DashboardPot> = {}): DashboardPot {
  return {
    pot_id: '1',
    title: 'Cabin',
    state: PotState.Funding,
    receipt_hash: null,
    total: TOTAL,
    share: SHARE,
    organizer_address: ORG,
    is_organizer: null,
    deadline: iso(NOW + 3 * HOUR),
    threshold: 2,
    objection_window_seconds: 86_400,
    request_window_seconds: 7 * 86_400,
    locked_at: null,
    objections_count: 0,
    release_eligible_at: null,
    members: [member(ME)],
    ...over,
  };
}

describe('DASHBOARD_POT_COLUMNS', () => {
  it('selects every column the model reads, with bigint-safe casts', () => {
    const cols = DASHBOARD_POT_COLUMNS.split(',');
    for (const c of ['pot_id::text', 'total::text', 'share::text', 'title', 'state', 'organizer_address',
      'deadline', 'threshold', 'objection_window_seconds', 'request_window_seconds', 'locked_at',
      'objections_count', 'release_eligible_at', 'members']) {
      expect(cols).toContain(c);
    }
  });
});

describe('needsYou', () => {
  it('returns nothing for a null address or an empty list', () => {
    expect(needsYou([pot()], null, NOW)).toEqual([]);
    expect(needsYou([], ME, NOW)).toEqual([]);
  });

  it('offers pay before the deadline with amount and time left', () => {
    const [item] = needsYou([pot()], ME, NOW);
    expect(item).toMatchObject({
      potId: '1', potTitle: 'Cabin', action: 'pay', label: 'Pay your share',
      hint: '2 USDC, closes in 3 h', href: '/pots/1',
    });
  });

  it('matches the address case-insensitively', () => {
    const p = pot({ members: [member(ME.toUpperCase().replace('0X', '0x'))] });
    expect(needsYou([p], ME, NOW)).toHaveLength(1);
  });

  it('skips pay once the viewer has paid, and for non-members', () => {
    expect(needsYou([pot({ members: [member(ME, { has_paid: true })] })], ME, NOW)).toEqual([]);
    expect(needsYou([pot({ members: [member(OTHER)] })], ME, NOW)).toEqual([]);
  });

  it('skips pay for an inactive seat', () => {
    expect(needsYou([pot({ members: [member(ME, { active: false })] })], ME, NOW)).toEqual([]);
  });

  it('offers refund in Funding after the deadline when the viewer paid', () => {
    const p = pot({ deadline: iso(NOW - HOUR), members: [member(ME, { has_paid: true })] });
    const [item] = needsYou([p], ME, NOW);
    expect(item).toMatchObject({ action: 'refund', label: 'Claim your refund', hint: 'Get your 2 USDC back' });
  });

  it('offers the organizer request-payout on a Locked pot', () => {
    const p = pot({ state: PotState.Locked, organizer_address: ME, locked_at: iso(NOW - HOUR) });
    const [item] = needsYou([p], ME, NOW);
    expect(item).toMatchObject({ action: 'request-payout', label: 'Request the payout', hint: '6 USDC locked, 6 days left to request' });
  });

  it('shows a plain locked hint once the request window has closed', () => {
    const p = pot({ state: PotState.Locked, organizer_address: ME, locked_at: iso(NOW - 8 * 86_400_000) });
    expect(needsYou([p], ME, NOW)[0].hint).toBe('6 USDC locked');
  });

  it('does not offer request-payout to a non-organizer on a Locked pot', () => {
    const p = pot({ state: PotState.Locked, members: [member(ME, { has_paid: true })] });
    expect(needsYou([p], ME, NOW)).toEqual([]);
  });

  it('offers review-payout to an unobjected member while the window is open', () => {
    const p = pot({
      state: PotState.PayoutRequested,
      release_eligible_at: iso(NOW + 2 * HOUR),
      members: [member(ME, { has_paid: true })],
    });
    const [item] = needsYou([p], ME, NOW);
    expect(item).toMatchObject({
      action: 'review-payout', label: 'Review the payout request', hint: '2 h left to object',
    });
  });

  it('omits review-payout once the viewer objected', () => {
    const p = pot({
      state: PotState.PayoutRequested,
      release_eligible_at: iso(NOW + 2 * HOUR),
      members: [member(ME, { has_objected: true })],
    });
    expect(needsYou([p], ME, NOW)).toEqual([]);
  });

  it('offers finalize after the window when objections are under the threshold', () => {
    const p = pot({
      state: PotState.PayoutRequested,
      release_eligible_at: iso(NOW - 1),
      objections_count: 1,
      threshold: 2,
      members: [member(ME, { has_paid: true })],
    });
    const [item] = needsYou([p], ME, NOW);
    expect(item).toMatchObject({ action: 'finalize', label: 'Finalize the payout' });
  });

  it('offers nothing after the window when objections reach the threshold', () => {
    const p = pot({
      state: PotState.PayoutRequested,
      release_eligible_at: iso(NOW - 1),
      objections_count: 2,
      threshold: 2,
      members: [member(ME, { has_paid: true })],
    });
    expect(needsYou([p], ME, NOW)).toEqual([]);
  });

  it('offers refund on a Frozen or Expired pot the viewer paid for', () => {
    const p = pot({ state: PotState.Frozen, members: [member(ME, { has_paid: true })] });
    expect(needsYou([p], ME, NOW)[0]).toMatchObject({ action: 'refund' });
  });

  it('skips refund once already refunded, and never offers anything on Released', () => {
    expect(needsYou([pot({ state: PotState.Frozen, members: [member(ME, { has_paid: true, has_refunded: true })] })], ME, NOW)).toEqual([]);
    expect(needsYou([pot({ state: PotState.Released, members: [member(ME, { has_paid: true })] })], ME, NOW)).toEqual([]);
  });

  it('sorts most urgent first and gives one item per pot', () => {
    const pots = [
      pot({ pot_id: '10', title: 'Relaxed pay', deadline: iso(NOW + 30 * 86_400_000) }),
      pot({ pot_id: '11', title: 'Fin', state: PotState.PayoutRequested, release_eligible_at: iso(NOW - 1), members: [member(ME, { has_paid: true })] }),
      pot({ pot_id: '12', title: 'Soon pay', deadline: iso(NOW + HOUR) }),
      pot({ pot_id: '13', title: 'Refund', state: PotState.Frozen, members: [member(ME, { has_paid: true })] }),
    ];
    const items = needsYou(pots, ME, NOW);
    expect(items.map(i => i.potId)).toEqual(['11', '12', '10', '13']);
    expect(new Set(items.map(i => i.potId)).size).toBe(items.length);
    for (let i = 1; i < items.length; i++) expect(items[i - 1].urgency).toBeGreaterThanOrEqual(items[i].urgency);
  });

  it('covers every action kind', () => {
    const kinds = new Set([
      needsYou([pot()], ME, NOW)[0].action,
      needsYou([pot({ state: PotState.Locked, organizer_address: ME })], ME, NOW)[0].action,
      needsYou([pot({ state: PotState.PayoutRequested, release_eligible_at: iso(NOW + HOUR), members: [member(ME)] })], ME, NOW)[0].action,
      needsYou([pot({ state: PotState.PayoutRequested, release_eligible_at: iso(NOW - 1), members: [member(ME)] })], ME, NOW)[0].action,
      needsYou([pot({ state: PotState.Frozen, members: [member(ME, { has_paid: true })] })], ME, NOW)[0].action,
    ]);
    expect([...kinds].sort()).toEqual(['finalize', 'pay', 'refund', 'request-payout', 'review-payout']);
  });
});

describe('heldAmount', () => {
  it('returns 0 for no pots', () => {
    expect(heldAmount([])).toBe(BigInt(0));
  });

  it('counts only paid, unrefunded shares while Funding', () => {
    const p = pot({
      members: [member(ME, { has_paid: true }), member(OTHER, { has_paid: true, has_refunded: true }), member(ORG)],
    });
    expect(heldAmount([p])).toBe(BigInt(SHARE));
  });

  it('counts the full total when Locked or PayoutRequested', () => {
    expect(heldAmount([pot({ state: PotState.Locked })])).toBe(BigInt(TOTAL));
    expect(heldAmount([pot({ state: PotState.PayoutRequested })])).toBe(BigInt(TOTAL));
  });

  it('counts still-refundable shares when Frozen and releases nothing when Released', () => {
    const p = pot({ state: PotState.Frozen, members: [member(ME, { has_paid: true }), member(OTHER, { has_paid: true })] });
    expect(heldAmount([p])).toBe(BigInt(SHARE) * BigInt(2));
    expect(heldAmount([pot({ state: PotState.Released })])).toBe(BigInt(0));
  });

  it('sums across pots with exact bigint math beyond Number precision', () => {
    const big = '123456789012345678901234567890';
    const p = pot({ state: PotState.Locked, total: big });
    const q = pot({ state: PotState.Locked, total: '1' });
    expect(heldAmount([p, q])).toBe(BigInt(big) + BigInt(1));
  });
});

describe('stateCounts', () => {
  it('returns zeros for an empty list', () => {
    expect(stateCounts([])).toEqual({ funding: 0, locked: 0, payout: 0, released: 0, closed: 0 });
  });

  it('counts each state, with Frozen (expired or objected) as closed', () => {
    const pots = [
      pot({ state: PotState.Funding }),
      pot({ state: PotState.Funding }),
      pot({ state: PotState.Locked }),
      pot({ state: PotState.PayoutRequested }),
      pot({ state: PotState.Released }),
      pot({ state: PotState.Frozen, receipt_hash: null }),
      pot({ state: PotState.Frozen, receipt_hash: '0x' + '1'.repeat(64) }),
    ];
    expect(stateCounts(pots)).toEqual({ funding: 2, locked: 1, payout: 1, released: 1, closed: 2 });
  });

  it('does not count a Locked pot past its request window as closed', () => {
    const p = pot({ state: PotState.Locked, locked_at: iso(NOW - 30 * 86_400_000) });
    expect(stateCounts([p]).closed).toBe(0);
    expect(stateCounts([p]).locked).toBe(1);
  });
});

describe('activityItems', () => {
  const titles = { '1': 'Cabin' };
  const ev = (id: number | string, event_name: string, args: Record<string, unknown> = {}, pot_id = '1'): ActivityEvent =>
    ({ id, pot_id, event_name, args });

  it('returns nothing for no events', () => {
    expect(activityItems([], titles, ME)).toEqual([]);
  });

  it('orders newest first by numeric id, including ids past Number precision', () => {
    const items = activityItems([
      ev(9, 'Locked'),
      ev('10000000000000000000001', 'Locked'),
      ev(10, 'Locked'),
    ], titles, null);
    expect(items.map(i => i.id)).toEqual(['10000000000000000000001', '10', '9']);
  });

  it('skips unknown event names without crashing', () => {
    const items = activityItems([ev(1, 'Mystery'), ev(2, 'Paid', { member: OTHER, amount: SHARE }), ev(3, '')], titles, ME);
    expect(items).toHaveLength(1);
    expect(items[0].text).toBe('A member paid 2 USDC');
  });

  it('says You when the viewer is the actor, A member otherwise', () => {
    const items = activityItems([ev(1, 'Paid', { member: ME, amount: SHARE }), ev(2, 'Paid', { member: OTHER, amount: SHARE })], titles, ME);
    expect(items.map(i => i.text)).toEqual(['A member paid 2 USDC', 'You paid 2 USDC']);
  });

  it('uses a known member email when one is supplied', () => {
    const items = activityItems([ev(1, 'Objected', { member: OTHER })], titles, ME, 12, { [OTHER]: 'friend@example.com' });
    expect(items[0].text).toBe('friend@example.com objected to the payout');
  });

  it('maps each known event to a tone', () => {
    const cases: Array<[string, ActivityEvent['args'], string]> = [
      ['PotCreated', { organizer: ME }, 'neutral'],
      ['Paid', { member: ME, amount: SHARE }, 'money'],
      ['Locked', {}, 'money'],
      ['SeatSwapped', { leaver: OTHER, replacement: ME, refunded: '0' }, 'neutral'],
      ['Refunded', { member: ME, amount: SHARE }, 'money'],
      ['PayoutRequested', { receiptHash: '0x00', releaseEligibleAt: '1' }, 'warn'],
      ['Objected', { member: OTHER, objectionsCount: '1' }, 'warn'],
      ['Released', { organizer: ORG, amount: TOTAL }, 'money'],
      ['Expired', {}, 'bad'],
      ['Frozen', {}, 'bad'],
    ];
    const items = activityItems(cases.map(([name, args], i) => ev(i + 1, name, args)), titles, ME, 50);
    expect(items).toHaveLength(cases.length);
    expect(items.map(i => i.tone)).toEqual([...cases].reverse().map(c => c[2]));
    for (const i of items) expect(i.text.length).toBeGreaterThan(0);
  });

  it('falls back to a pot number when the title is unknown', () => {
    const items = activityItems([ev(1, 'Locked', {}, '77')], titles, ME);
    expect(items[0]).toMatchObject({ potId: '77', potTitle: 'Pot #77', id: '1', tone: 'money' });
  });

  it('caps the result at limit after skipping unknown names', () => {
    const events = [ev(1, 'Locked'), ev(2, 'Nope'), ev(3, 'Locked'), ev(4, 'Locked')];
    expect(activityItems(events, titles, ME, 2)).toHaveLength(2);
    expect(activityItems(events, titles, ME, 2).map(i => i.id)).toEqual(['4', '3']);
  });

  it('defaults the limit to 12', () => {
    const events = Array.from({ length: 20 }, (_, i) => ev(i + 1, 'Locked'));
    expect(activityItems(events, titles, ME)).toHaveLength(12);
  });

  it('does not invent a timestamp', () => {
    const [item] = activityItems([ev(1, 'Locked')], titles, ME);
    expect(Object.keys(item).sort()).toEqual(['id', 'potId', 'potTitle', 'text', 'tone']);
  });
});
