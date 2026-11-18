import { keccak256, toBytes } from 'viem';
import { PotState } from '@/lib/pot/chain';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import type { DashboardPot } from '@/components/pot/dashboardModel';
import type { HistoryItem } from '@/components/pot/historyModel';

/**
 * Sample data for the public /demo. Invented people, invented plans, test-money amounts: nothing here is read
 * from or written to the database or the chain. Everything is placed relative to `now`, so a plan that "closes
 * in 30 hours" always does, however long ago the demo was built.
 */

const H = 3_600_000;
const D = 24 * H;

/** The demo viewer's made-up wallet. It does not exist anywhere and never receives money. */
export const DEMO_WALLET = '0x00000000000000000000000000000000000a11ce';
export const DEMO_ME = { name: 'Alex Morgan', email: 'alex@example.com' } as const;

const dollars = (n: number): string => (BigInt(n) * BigInt(10) ** BigInt(18)).toString();
const addressOf = (n: number): string => `0x${n.toString(16).padStart(40, '0')}`;
const NAMES = ['Maya', 'Jon', 'Priya', 'Theo', 'Dana', 'Sam', 'Leo', 'Ravi', 'Kim', 'Noor', 'Eli'];

type Seat = Partial<PotStatusRow['members'][number]> & { paid?: boolean };

/**
 * `count` seats. Seat 0 is the viewer (Alex); the rest are the NAMES in order. `paid` is how many seats from
 * the top have paid (or 'all'), `organizer` is the seat index that organizes, and `overrides` changes single
 * seats: `{ 0: { paid: false } }`.
 */
function seats(count: number, paid: number | 'all', organizer: number, overrides: Record<number, Seat> = {}): PotStatusRow['members'] {
  return Array.from({ length: count }, (_, i) => {
    const { paid: paidOverride, ...rest } = overrides[i] ?? {};
    const has_paid = paidOverride ?? (paid === 'all' ? true : i < paid);
    return {
      address: i === 0 ? DEMO_WALLET : addressOf(0xb0 + i),
      email: i === 0 ? DEMO_ME.email : null,
      name: i === 0 ? DEMO_ME.name : (NAMES[i - 1] ?? `Friend ${i}`),
      has_paid, has_objected: false, has_refunded: false, active: true,
      is_organizer: i === organizer,
      ...rest,
    };
  });
}

const receiptHash = (text: string): string => keccak256(toBytes(text));

export type DemoData = {
  /** The clock everything is placed against (ms since epoch). */
  now: number;
  /** Full rows, as the plan page reads them. */
  plans: PotStatusRow[];
  /** The same plans in the shape the dashboard reads. */
  pots: DashboardPot[];
  /** Alex's payments, refunds and payouts, newest first. */
  history: HistoryItem[];
};

/** The demo's plans, the dashboard's view of them and Alex's history, all relative to `now` (ms since epoch). */
export function buildDemo(now: number): DemoData {
  const iso = (offsetMs: number): string => new Date(now + offsetMs).toISOString();
  const plan = (p: Partial<PotStatusRow> & Pick<PotStatusRow, 'pot_id' | 'title' | 'state' | 'total' | 'share' | 'members'>): PotStatusRow => {
    const organizer = p.members.find(m => m.is_organizer);
    const organizerAddress = organizer?.address ?? DEMO_WALLET;
    return {
      organizer_address: organizerAddress,
      deadline: iso(2 * D), threshold: Math.max(1, Math.ceil(p.members.length / 3)),
      objection_window_seconds: 2 * 86_400, request_window_seconds: 7 * 86_400,
      locked_at: null, payments_count: p.members.filter(m => m.has_paid).length, objections_count: 0,
      receipt_hash: null, release_eligible_at: null, updated_at: iso(0), invite_token: null,
      receipt_text: null, created_at: iso(-7 * D), is_organizer: organizerAddress === DEMO_WALLET,
      ...p,
    };
  };

  const BIRTHDAY_RECEIPT = 'Nightingale, table for 4 on Saturday. Confirmation #4417';
  const CAMPING_RECEIPT = 'Recreation.gov permit RG-20931';
  const HOODIE_RECEIPT = 'Printful order 88213: 12 hoodies, mixed sizes';
  const CONCERT_RECEIPT = 'Ticketmaster order 7741-B, section 112';

  const plans: PotStatusRow[] = [
    // Funding, and Alex has not paid yet: "Pay your share".
    plan({
      pot_id: 'lake-house', title: 'Lake house, August', state: PotState.Funding,
      total: dollars(2400), share: dollars(600), deadline: iso(30 * H), threshold: 2, created_at: iso(-5 * D),
      members: seats(4, 4, 1, { 0: { paid: false } }),
    }),
    // Locked, and Alex organizes: "Request the payout".
    plan({
      pot_id: 'whistler', title: 'Whistler ski trip', state: PotState.Locked,
      total: dollars(2400), share: dollars(300), deadline: iso(2 * D), locked_at: iso(-5 * H), threshold: 3, created_at: iso(-9 * D),
      members: seats(8, 'all', 0),
    }),
    // Payout requested, and Alex can still object: "Review the payout request".
    plan({
      pot_id: 'birthday-dinner', title: "Maya's birthday dinner", state: PotState.PayoutRequested,
      total: dollars(240), share: dollars(60), deadline: iso(-3 * D), locked_at: iso(-30 * H), threshold: 2, created_at: iso(-8 * D),
      receipt_text: BIRTHDAY_RECEIPT, receipt_hash: receiptHash(BIRTHDAY_RECEIPT), release_eligible_at: iso(22 * H),
      members: seats(4, 'all', 1),
    }),
    // Funding, and Alex is in: waiting on one more share, closing in four days.
    plan({
      pot_id: 'cabin-weekend', title: 'Cabin weekend', state: PotState.Funding,
      total: dollars(600), share: dollars(150), deadline: iso(4 * D), threshold: 2, created_at: iso(-4 * D),
      members: seats(4, 3, 1),
    }),
    // Released to the organizer.
    plan({
      pot_id: 'camping-permits', title: 'Camping permits', state: PotState.Released,
      total: dollars(90), share: dollars(30), deadline: iso(-13 * D), locked_at: iso(-12 * D), threshold: 1, created_at: iso(-16 * D),
      receipt_text: CAMPING_RECEIPT, receipt_hash: receiptHash(CAMPING_RECEIPT),
      members: seats(3, 'all', 1),
    }),
    // A bigger group, released to Alex as the organizer. This is the "run it again" example.
    plan({
      pot_id: 'hoodie-order', title: 'Chapter hoodie order', state: PotState.Released,
      total: dollars(540), share: dollars(45), deadline: iso(-7 * D), locked_at: iso(-6 * D), threshold: 4, created_at: iso(-11 * D),
      receipt_text: HOODIE_RECEIPT, receipt_hash: receiptHash(HOODIE_RECEIPT),
      members: seats(12, 'all', 0),
    }),
    // Frozen by objections: Alex objected and already took his share back; the others still can.
    plan({
      pot_id: 'concert-tickets', title: 'Concert tickets', state: PotState.Frozen,
      total: dollars(340), share: dollars(85), deadline: iso(-8 * D), locked_at: iso(-7 * D), threshold: 2, objections_count: 2, created_at: iso(-12 * D),
      receipt_text: CONCERT_RECEIPT, receipt_hash: receiptHash(CONCERT_RECEIPT),
      members: seats(4, 'all', 3, { 0: { has_objected: true, has_refunded: true }, 1: { has_objected: true } }),
    }),
  ];

  const pots: DashboardPot[] = plans.map(p => ({
    pot_id: p.pot_id, title: p.title, state: p.state, receipt_hash: p.receipt_hash, total: p.total, share: p.share,
    organizer_address: p.organizer_address, is_organizer: p.is_organizer, deadline: p.deadline, threshold: p.threshold,
    objection_window_seconds: p.objection_window_seconds, request_window_seconds: p.request_window_seconds,
    locked_at: p.locked_at, objections_count: p.objections_count, release_eligible_at: p.release_eligible_at,
    members: p.members,
  }));

  const title = (id: string): string => plans.find(p => p.pot_id === id)?.title ?? id;
  const item = (id: string, kind: HistoryItem['kind'], potId: string, amount: number, ago: number, receiptText?: string): HistoryItem => ({
    id, kind, potId, potTitle: title(potId), amount: dollars(amount), at: iso(-ago),
    ...(receiptText ? { receiptText } : {}),
  });
  const history: HistoryItem[] = [
    item('h8', 'paid', 'cabin-weekend', 150, 1 * D),
    item('h7', 'paid', 'birthday-dinner', 60, 2 * D),
    item('h6', 'paid', 'whistler', 300, 3 * D),
    item('h5', 'payout-received', 'hoodie-order', 540, 4 * D, HOODIE_RECEIPT),
    item('h4', 'refunded', 'concert-tickets', 85, 5 * D),
    item('h3', 'paid', 'hoodie-order', 45, 8 * D),
    item('h2', 'paid', 'concert-tickets', 85, 9 * D),
    item('h1', 'paid', 'camping-permits', 30, 14 * D),
  ];

  return { now, plans, pots, history };
}

/** The demo as of this request. A function of its own so a page can call it without reading the clock in a component. */
export const demoAtRequest = (): DemoData => buildDemo(Date.now());

/** The plan with this id, or undefined. */
export const findDemoPlan = (demo: DemoData, potId: string): PotStatusRow | undefined => demo.plans.find(p => p.pot_id === potId);
