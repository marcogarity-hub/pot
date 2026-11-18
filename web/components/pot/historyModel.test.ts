import { describe, expect, it } from 'vitest';
import { buildHistory, historySentence, paidSummary, type HistoryEventRow, type HistoryItem } from './historyModel';

const ME = '0x00000000000000000000000000000000000000a1';
const OTHER = '0x00000000000000000000000000000000000000bb';
const U = (n: number) => (BigInt(n) * BigInt(10) ** BigInt(18)).toString();
const meta = [
  { pot_id: '7', title: 'Cabin weekend', receipt_text: 'Airbnb HMX123' },
  { pot_id: '8', title: null, receipt_text: null },
];

describe('buildHistory', () => {
  it('carries the recorded time through, and leaves it empty for events recorded before timestamps existed', () => {
    const events: HistoryEventRow[] = [
      { id: 1, pot_id: '7', event_name: 'Paid', args: { potId: '7', member: ME, amount: U(210) } },
      { id: 2, pot_id: '7', event_name: 'Refunded', args: { potId: '7', member: ME, amount: U(210) }, created_at: '2026-11-19T15:04:05+00:00' },
    ];
    const items = buildHistory(events, meta, ME);
    expect(items.find(i => i.id === '2')?.at).toBe('2026-11-19T15:04:05+00:00');
    expect(items.find(i => i.id === '1')?.at).toBeNull();
  });

  it('lists what I paid, what I got back and, as organizer, the payout I received, newest first', () => {
    const events: HistoryEventRow[] = [
      { id: 1, pot_id: '7', event_name: 'Paid', args: { potId: '7', member: ME, amount: U(210) } },
      { id: 2, pot_id: '7', event_name: 'Paid', args: { potId: '7', member: OTHER, amount: U(210) } },
      { id: 3, pot_id: '8', event_name: 'Refunded', args: { potId: '8', member: ME, amount: U(40) } },
      { id: 4, pot_id: '7', event_name: 'Released', args: { potId: '7', organizer: ME, amount: U(1260) } },
      { id: 9, pot_id: '8', event_name: 'Paid', args: { potId: '8', member: ME, amount: U(5) } },
    ];
    const items = buildHistory(events, meta, ME);
    expect(items.map(i => i.id)).toEqual(['9', '4', '3', '1']);
    expect(items[1]).toEqual({
      id: '4', kind: 'payout-received', potId: '7', potTitle: 'Cabin weekend', amount: U(1260), at: null,
      receiptText: 'Airbnb HMX123',
    });
    expect(items[2]).toMatchObject({ kind: 'refunded', amount: U(40) });
    expect(items[2]).not.toHaveProperty('receiptText');
    expect(items[0].potTitle).toBe('Plan #8');
  });

  it('counts a seat swap refund only for the leaver and only when money came back', () => {
    const events: HistoryEventRow[] = [
      { id: 1, pot_id: '7', event_name: 'SeatSwapped', args: { leaver: ME, replacement: OTHER, refunded: U(210) } },
      { id: 2, pot_id: '7', event_name: 'SeatSwapped', args: { leaver: ME, replacement: OTHER, refunded: '0' } },
      { id: 3, pot_id: '7', event_name: 'SeatSwapped', args: { leaver: OTHER, replacement: ME, refunded: U(9) } },
    ];
    const items = buildHistory(events, meta, ME);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ kind: 'refunded', amount: U(210) });
  });

  it('keeps the item with no amount when the event has none, and ignores unknown events', () => {
    const events: HistoryEventRow[] = [
      { id: 1, pot_id: '7', event_name: 'Paid', args: { member: ME } },
      { id: 2, pot_id: '7', event_name: 'Paid', args: { member: ME, amount: 'lots' } },
      { id: 3, pot_id: '7', event_name: 'Locked', args: { potId: '7', lockedAt: '1' } },
    ];
    const items = buildHistory(events, meta, ME);
    expect(items.map(i => [i.id, i.amount])).toEqual([['2', undefined], ['1', undefined]]);
  });

  it('returns nothing without a wallet address', () => {
    const events: HistoryEventRow[] = [{ id: 1, pot_id: '7', event_name: 'Paid', args: { member: ME, amount: U(1) } }];
    expect(buildHistory(events, meta, null)).toEqual([]);
  });

  it('gives a payout no receipt when the pot has none', () => {
    const events: HistoryEventRow[] = [{ id: 1, pot_id: '8', event_name: 'Released', args: { organizer: ME, amount: U(3) } }];
    expect(buildHistory(events, meta, ME)[0]).not.toHaveProperty('receiptText');
  });
});

describe('historySentence', () => {
  const base = { id: '1', potId: '7', potTitle: 'Cabin', at: null };
  it('reads as one plain sentence per kind', () => {
    expect(historySentence({ ...base, kind: 'paid', amount: U(210) })).toBe('You paid $210');
    expect(historySentence({ ...base, kind: 'refunded', amount: U(40) })).toBe('You got a refund of $40');
    expect(historySentence({ ...base, kind: 'payout-received', amount: U(1260) })).toBe('You received $1,260');
  });
  it('falls back without an amount', () => {
    expect(historySentence({ ...base, kind: 'paid' } as HistoryItem)).toBe('You paid your share');
    expect(historySentence({ ...base, kind: 'refunded' } as HistoryItem)).toBe('You got a refund');
    expect(historySentence({ ...base, kind: 'payout-received' } as HistoryItem)).toBe('You received the payout');
  });
});

describe('paidSummary', () => {
  const paid = (potId: string, amount?: string): HistoryItem => ({
    id: potId + amount, kind: 'paid', potId, potTitle: 'x', at: null, ...(amount ? { amount } : {}),
  });
  it('sums payments across distinct plans and ignores refunds', () => {
    const items: HistoryItem[] = [
      paid('7', U(210)), paid('7', U(210)), paid('8', U(40)),
      { id: 'r', kind: 'refunded', potId: '8', potTitle: 'x', at: null, amount: U(40) },
    ];
    expect(paidSummary(items)).toEqual({ total: '$460', plans: 2 });
  });
  it('is null when nothing was paid or an amount is missing', () => {
    expect(paidSummary([])).toBeNull();
    expect(paidSummary([paid('7', U(210)), paid('8')])).toBeNull();
  });
});
