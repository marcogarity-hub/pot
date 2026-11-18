import { describe, expect, it } from 'vitest';
import { PotState } from '@/lib/pot/chain';
import {
  DASHBOARD_POT_COLUMNS,
  closingSoon,
  firstName,
  formatDuration,
  groupNeeds,
  heldAmount,
  heldPotCount,
  needsYou,
  type DashboardMember,
  type DashboardPot,
  type QueueItem,
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
      hint: '$2, closes in 3 h', href: '/pots/1',
    });
  });

  it('shows the members who still have to pay as faces on the pay row', () => {
    const [item] = needsYou([pot()], ME, NOW);
    expect(item.faces?.length).toBeGreaterThan(0);
    expect(item.faces?.every(f => f.paid === false)).toBe(true);
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
    expect(item).toMatchObject({ action: 'refund', label: 'Claim your refund', hint: 'Get your $2 back' });
  });

  it('offers the organizer request-payout on a Locked pot', () => {
    const p = pot({ state: PotState.Locked, organizer_address: ME, locked_at: iso(NOW - HOUR) });
    const [item] = needsYou([p], ME, NOW);
    expect(item).toMatchObject({ action: 'request-payout', label: 'Request the payout', hint: '$6 locked, 6 days left to request' });
  });

  it('shows a plain locked hint once the request window has closed', () => {
    const p = pot({ state: PotState.Locked, organizer_address: ME, locked_at: iso(NOW - 8 * 86_400_000) });
    expect(needsYou([p], ME, NOW)[0].hint).toBe('$6 locked');
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

describe('heldPotCount', () => {
  it('counts only the pots that still hold money', () => {
    const holding = pot({ state: PotState.Locked });
    const released = pot({ state: PotState.Released });
    expect(heldPotCount([holding, released])).toBe(1);
    expect(heldPotCount([])).toBe(0);
  });
});

describe('firstName', () => {
  it('takes the first word of the display name', () => {
    expect(firstName('Ana Rivera')).toBe('Ana');
    expect(firstName('  Ben  ')).toBe('Ben');
  });

  it('is null when no usable name is set, and never reads an email', () => {
    expect(firstName(null)).toBeNull();
    expect(firstName('   ')).toBeNull();
  });
});

describe('formatDuration', () => {
  it('names the largest sensible unit', () => {
    expect(formatDuration(30_000)).toBe('less than a minute');
    expect(formatDuration(5 * 60_000)).toBe('5 min');
    expect(formatDuration(5 * HOUR)).toBe('5 h');
    expect(formatDuration(86_400_000)).toBe('1 day');
    expect(formatDuration(3 * 86_400_000)).toBe('3 days');
  });
});

const item = (over: Partial<QueueItem> = {}): QueueItem => ({
  potId: '1', potTitle: 'Cabin', action: 'pay', label: 'Pay your share', hint: '$2, closes in 3 h', href: '/pots/1', urgency: 70, ...over,
});

describe('groupNeeds', () => {
  it('returns nothing for an empty queue', () => {
    expect(groupNeeds([])).toEqual([]);
  });

  it('groups by action in first-appearance order and picks the soonest deadline', () => {
    const groups = groupNeeds([
      item({ potId: '1', action: 'finalize', label: 'Finalize the payout' }),
      item({ potId: '2', dueAt: NOW + 5 * HOUR }),
      item({ potId: '3', dueAt: NOW + 2 * HOUR }),
      item({ potId: '4', action: 'refund', label: 'Claim your refund' }),
    ]);
    expect(groups.map(g => g.action)).toEqual(['finalize', 'pay', 'refund']);
    expect(groups[1].items.map(i => i.potId)).toEqual(['2', '3']);
    expect(groups[1].soonest.potId).toBe('3');
    expect(groups[0].soonest.potId).toBe('1');
  });
});

describe('closingSoon', () => {
  it('lists funding pots due within seven days, soonest first, with paid counts', () => {
    const pots = [
      pot({ pot_id: '1', deadline: iso(NOW + 5 * 86_400_000), members: [member(ME, { has_paid: true }), member(OTHER)] }),
      pot({ pot_id: '2', deadline: iso(NOW + 1 * 86_400_000) }),
      pot({ pot_id: '3', deadline: iso(NOW + 9 * 86_400_000) }),
      pot({ pot_id: '4', state: PotState.Locked, deadline: iso(NOW + 1 * 86_400_000) }),
      pot({ pot_id: '5', deadline: iso(NOW - 1 * HOUR) }),
    ];
    const out = closingSoon(pots, NOW);
    expect(out.map(c => c.potId)).toEqual(['2', '1']);
    expect(out[1]).toMatchObject({ paid: 1, members: 2, title: 'Cabin' });
  });

  it('is empty when nothing is closing soon', () => {
    expect(closingSoon([pot({ deadline: iso(NOW + 30 * 86_400_000) })], NOW)).toEqual([]);
  });
});

describe('needsYou dueAt', () => {
  it('records the deadline a pay row waits on', () => {
    const [row] = needsYou([pot({ members: [member(ME)] })], ME, NOW);
    expect(row.dueAt).toBe(Date.parse(iso(NOW + 3 * HOUR)));
  });
});
