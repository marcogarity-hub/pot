import { formatDollars } from '@/lib/format/money';

/**
 * Pure logic behind "what I paid for": the signed-in viewer's own money movements, newest first.
 * No network, no React. Rows come from pot_events (RLS-limited to pots the viewer is in) and pot_meta.
 *
 * pot_events has no timestamp column, so `at` is null for every item today. It is set only if a row carries one.
 * Order is by pot_events.id, which follows chain order.
 */

export type HistoryKind = 'paid' | 'refunded' | 'payout-received';

export type HistoryItem = {
  id: string;
  kind: HistoryKind;
  potId: string;
  potTitle: string;
  /** 18-decimal base units, as decimal text. Absent when the event carries no amount. */
  amount?: string;
  /** ISO time of the movement. Null because pot_events stores no time. */
  at: string | null;
  /** Organizer's receipt text for the pot. Shown on payouts only. */
  receiptText?: string;
};

/** A row from pot_events, as selected by useHistory. `args` holds the decoded event arguments. */
export type HistoryEventRow = { id: number | string; pot_id: string; event_name: string; args: Record<string, unknown> };
/** A row from pot_meta. Title and receipt text can be missing while API metadata is delayed. */
export type HistoryPotMeta = { pot_id: string; title: string | null; receipt_text: string | null };

/** The only events that move money to or from a person. Payout-sent has no event: a payout is one Released to the organizer. */
export const HISTORY_EVENT_NAMES = ['Paid', 'Refunded', 'Released', 'SeatSwapped'] as const;

const idValue = (id: number | string): bigint => {
  try {
    return BigInt(String(id));
  } catch {
    return BigInt(-1);
  }
};

const addressArg = (value: unknown): string => (typeof value === 'string' ? value.toLowerCase() : '');

/** Amounts are decimal text in the args. Anything else is treated as missing rather than shown wrong. */
const amountArg = (value: unknown): string | undefined => {
  const text = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
  return /^\d+$/.test(text) ? text : undefined;
};

type Movement = Omit<HistoryItem, 'id' | 'potId' | 'potTitle' | 'at'> | null;

/** What this event means for `me`, or null when it does not move money to or from them. */
function movementFor(e: HistoryEventRow, me: string): Movement {
  const args = e.args ?? {};
  switch (e.event_name) {
    case 'Paid':
      return addressArg(args.member) === me ? { kind: 'paid', amount: amountArg(args.amount) } : null;
    case 'Refunded':
      return addressArg(args.member) === me ? { kind: 'refunded', amount: amountArg(args.amount) } : null;
    case 'SeatSwapped': {
      // A leaver is refunded only when a refund was paid out (refunded > 0).
      const refunded = amountArg(args.refunded);
      return addressArg(args.leaver) === me && refunded !== undefined && BigInt(refunded) > BigInt(0)
        ? { kind: 'refunded', amount: refunded }
        : null;
    }
    case 'Released':
      return addressArg(args.organizer) === me ? { kind: 'payout-received', amount: amountArg(args.amount) } : null;
    default:
      return null;
  }
}

/**
 * The viewer's money movements, newest first. Events that do not involve `myAddress` are skipped, and so are
 * unknown event names. Returns [] without a wallet address.
 */
export function buildHistory(
  events: HistoryEventRow[],
  potMeta: HistoryPotMeta[],
  myAddress: string | null,
): HistoryItem[] {
  if (!myAddress) return [];
  const me = myAddress.toLowerCase();
  const meta = new Map(potMeta.map(m => [m.pot_id, m]));
  const ordered = [...events].sort((a, b) => {
    const av = idValue(a.id);
    const bv = idValue(b.id);
    return av > bv ? -1 : av < bv ? 1 : 0;
  });
  const items: HistoryItem[] = [];
  for (const e of ordered) {
    const movement = movementFor(e, me);
    if (!movement) continue;
    const pot = meta.get(e.pot_id);
    const item: HistoryItem = {
      id: String(e.id),
      kind: movement.kind,
      potId: e.pot_id,
      potTitle: pot?.title ?? `Plan #${e.pot_id}`,
      at: null,
    };
    if (movement.amount !== undefined) item.amount = movement.amount;
    if (movement.kind === 'payout-received' && pot?.receipt_text) item.receiptText = pot.receipt_text;
    items.push(item);
  }
  return items;
}

/** The plain sentence for one item, e.g. "You paid $210". Dollars when the amount is known. */
export function historySentence(item: HistoryItem): string {
  const amount = item.amount !== undefined ? formatDollars(item.amount) : null;
  switch (item.kind) {
    case 'paid':
      return amount ? `You paid ${amount}` : 'You paid your share';
    case 'refunded':
      return amount ? `You got a refund of ${amount}` : 'You got a refund';
    case 'payout-received':
      return amount ? `You received ${amount}` : 'You received the payout';
  }
}

/**
 * "You've paid $X across N plans". Null unless every payment in the list has an amount, so the total is never partial.
 * Refunds are not subtracted: this is what was paid in.
 */
export function paidSummary(items: HistoryItem[]): { total: string; plans: number } | null {
  const paid = items.filter(i => i.kind === 'paid');
  if (paid.length === 0 || paid.some(i => i.amount === undefined)) return null;
  const total = paid.reduce((sum, i) => sum + BigInt(i.amount as string), BigInt(0));
  return { total: formatDollars(total), plans: new Set(paid.map(i => i.potId)).size };
}
