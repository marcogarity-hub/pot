import { describe, expect, it } from 'vitest';
import { availableActions, verifiedReceipt } from '@/components/pot/actions';
import { closingSoon, heldAmount, heldPotCount, needsYou } from '@/components/pot/dashboardModel';
import { paidSummary } from '@/components/pot/historyModel';
import { DEMO_WALLET, buildDemo, findDemoPlan } from './data';

const NOW = Date.parse('2026-11-18T15:00:00Z');
const demo = buildDemo(NOW);

describe('demo data', () => {
  it('has seven plans with unique ids, and the dashboard rows match the plan rows', () => {
    expect(demo.plans).toHaveLength(7);
    expect(new Set(demo.plans.map(p => p.pot_id)).size).toBe(7);
    expect(demo.pots.map(p => p.pot_id)).toEqual(demo.plans.map(p => p.pot_id));
    expect(findDemoPlan(demo, 'whistler')?.title).toBe('Whistler ski trip');
    expect(findDemoPlan(demo, 'nope')).toBeUndefined();
  });

  it('asks Alex for three different things: pay, request the payout, review a payout', () => {
    const queue = needsYou(demo.pots, DEMO_WALLET, NOW);
    expect(queue.map(q => [q.potId, q.action]).sort()).toEqual([
      ['birthday-dinner', 'review-payout'],
      ['lake-house', 'pay'],
      ['whistler', 'request-payout'],
    ]);
  });

  it('offers the plan page the matching action for every plan', () => {
    const at = new Date(NOW);
    const actions = Object.fromEntries(demo.plans.map(p => [p.pot_id, availableActions(p, DEMO_WALLET, at)]));
    expect(actions).toEqual({
      'lake-house': ['pay'],
      whistler: ['requestRelease'],
      'birthday-dinner': ['object'],
      'cabin-weekend': [],
      'camping-permits': [],
      'hoodie-order': [],
      'concert-tickets': [],
    });
  });

  it('holds money in five plans and closes two within the week', () => {
    expect(heldPotCount(demo.pots)).toBe(5);
    // $1,800 + $2,400 + $240 + $450 + $255
    expect(heldAmount(demo.pots)).toBe(BigInt(5145) * BigInt(10) ** BigInt(18));
    expect(closingSoon(demo.pots, NOW).map(c => c.potId)).toEqual(['lake-house', 'cabin-weekend']);
  });

  it('places everything relative to now, so shifting the clock shifts the deadlines with it', () => {
    const later = buildDemo(NOW + 3 * 86_400_000);
    const msLeft = (d: typeof demo, now: number) => Date.parse(findDemoPlan(d, 'lake-house')!.deadline) - now;
    expect(msLeft(demo, NOW)).toBe(30 * 3_600_000);
    expect(msLeft(later, NOW + 3 * 86_400_000)).toBe(30 * 3_600_000);
  });

  it('shows receipts that match their on-chain hash', () => {
    const withReceipts = demo.plans.filter(p => p.receipt_text);
    expect(withReceipts.length).toBe(4);
    for (const p of withReceipts) expect(verifiedReceipt(p.receipt_text, p.receipt_hash)).toBe(p.receipt_text);
  });

  it('lists Alex\'s history newest first, all on real demo plans, with dates', () => {
    const times = demo.history.map(h => Date.parse(h.at ?? ''));
    expect(times.every(Number.isFinite)).toBe(true);
    expect([...times].sort((a, b) => b - a)).toEqual(times);
    for (const h of demo.history) expect(findDemoPlan(demo, h.potId)?.title).toBe(h.potTitle);
    expect(demo.history.filter(h => h.kind === 'payout-received')).toHaveLength(1);
    expect(paidSummary(demo.history)).toEqual({ total: '$670', plans: 6 });
  });

  it('never carries anyone else\'s email, the same as the real masked view', () => {
    for (const p of demo.plans) {
      for (const m of p.members) {
        if (m.address === DEMO_WALLET) expect(m.email).toBe('alex@example.com');
        else expect(m.email).toBeNull();
      }
    }
  });

  it('uses only well-formed made-up addresses and no invite links', () => {
    for (const p of demo.plans) {
      expect(p.invite_token).toBeNull();
      for (const m of p.members) expect(m.address).toMatch(/^0x[0-9a-f]{40}$/);
    }
  });
});
