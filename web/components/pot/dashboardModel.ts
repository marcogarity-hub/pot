import { formatUnits } from 'viem';
import { PotState } from '@/lib/pot/chain';

/**
 * Pure logic behind the signed-in dashboard. No network, no React.
 *
 * "What can this viewer do now" mirrors availableActions() in ./actions.ts, which drives the pot page.
 * Keep the two in step: a change to one rule belongs in both.
 */

/** PostgREST select for the pot_status view. Money and ids are text so bigint-sized values survive JSON. */
export const DASHBOARD_POT_COLUMNS =
  'pot_id::text,title,state,receipt_hash,total::text,share::text,organizer_address,is_organizer,deadline,threshold,objection_window_seconds,request_window_seconds,locked_at,objections_count,release_eligible_at,members';

export type DashboardMember = {
  address: string;
  email: string | null;
  name: string | null;
  has_paid: boolean;
  has_objected: boolean;
  has_refunded: boolean;
  active: boolean;
  is_organizer: boolean;
};

export type DashboardPot = {
  pot_id: string;
  title: string | null;
  state: number;
  receipt_hash: string | null;
  /** 18-decimal base units, as decimal text. */
  total: string;
  /** 18-decimal base units, as decimal text. */
  share: string;
  organizer_address: string;
  /** Computed by the view for the signed-in session. Not used for "you" checks, which compare myAddress. */
  is_organizer: boolean | null;
  deadline: string;
  threshold: number;
  objection_window_seconds: number;
  request_window_seconds: number;
  locked_at: string | null;
  objections_count: number;
  release_eligible_at: string | null;
  members: DashboardMember[];
};

export type QueueItem = {
  potId: string;
  potTitle: string;
  action: 'pay' | 'request-payout' | 'review-payout' | 'finalize' | 'refund';
  label: string;
  hint: string;
  href: string;
  urgency: number;
};

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

const ms = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN);

function formatDuration(remainingMs: number): string {
  const mins = Math.floor(remainingMs / MINUTE_MS);
  if (mins < 1) return 'less than a minute';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day' : `${days} days`;
}

/** Adds up to 10 urgency points as a time-limited deadline gets within a day. */
function timeBoost(remainingMs: number): number {
  if (!(remainingMs > 0)) return 0;
  return Math.round(10 * Math.max(0, 1 - remainingMs / DAY_MS));
}

function usdc(raw: string): string {
  return `${formatUnits(BigInt(raw), 18)} USDC`;
}

function nextAction(p: DashboardPot, me: string, now: number): QueueItem | null {
  const base = { potId: p.pot_id, potTitle: p.title ?? `Pot #${p.pot_id}`, href: `/pots/${p.pot_id}` };
  const isOrganizer = p.organizer_address.toLowerCase() === me;
  const mine = p.members.find(m => m.active && m.address.toLowerCase() === me);
  const canRefund = !!mine && mine.has_paid && !mine.has_refunded;
  const refund = (): QueueItem => ({
    ...base, action: 'refund', label: 'Claim your refund',
    hint: `Get your ${usdc(p.share)} back`, urgency: 60,
  });

  switch (p.state) {
    case PotState.Funding: {
      const deadline = ms(p.deadline);
      if (now < deadline) {
        if (mine && !mine.has_paid) {
          const left = deadline - now;
          return {
            ...base, action: 'pay', label: 'Pay your share',
            hint: `${usdc(p.share)}, closes in ${formatDuration(left)}`, urgency: 70 + timeBoost(left),
          };
        }
        return null;
      }
      return canRefund ? refund() : null;
    }
    case PotState.Locked: {
      if (!isOrganizer) return null;
      const windowEnds = ms(p.locked_at) + p.request_window_seconds * 1000;
      const left = windowEnds - now;
      const hint = left > 0
        ? `${usdc(p.total)} locked, ${formatDuration(left)} left to request`
        : `${usdc(p.total)} locked`;
      return { ...base, action: 'request-payout', label: 'Request the payout', hint, urgency: 50 };
    }
    case PotState.PayoutRequested: {
      const eligibleAt = ms(p.release_eligible_at);
      if (now < eligibleAt) {
        if (mine && !mine.has_objected) {
          const left = eligibleAt - now;
          return {
            ...base, action: 'review-payout', label: 'Review the payout request',
            hint: `${formatDuration(left)} left to object`, urgency: 80 + timeBoost(left),
          };
        }
        return null;
      }
      if (p.objections_count < p.threshold) {
        return {
          ...base, action: 'finalize', label: 'Finalize the payout',
          hint: 'The objection window has ended', urgency: 95,
        };
      }
      return null;
    }
    case PotState.Frozen:
      return canRefund ? refund() : null;
    default:
      return null;
  }
}

/**
 * The single next action per pot that this viewer can take now, most urgent first.
 * Rules follow availableActions() in ./actions.ts. The view's is_organizer flag is session-bound, so the
 * organizer check compares organizer_address with myAddress instead.
 */
export function needsYou(pots: DashboardPot[], myAddress: string | null, nowMs: number): QueueItem[] {
  if (!myAddress) return [];
  const me = myAddress.toLowerCase();
  const items: QueueItem[] = [];
  for (const p of pots) {
    const item = nextAction(p, me, nowMs);
    if (item) items.push(item);
  }
  return items.sort((a, b) => b.urgency - a.urgency || a.potId.localeCompare(b.potId));
}

/** Money inside the contract for these pots, in 18-decimal base units. */
export function heldAmount(pots: DashboardPot[]): bigint {
  let sum = BigInt(0);
  for (const p of pots) {
    switch (p.state) {
      case PotState.Funding:
      case PotState.Frozen: {
        // Still refundable: a paid share sits in the contract until its owner takes it back.
        const refundable = p.members.filter(m => m.has_paid && !m.has_refunded).length;
        sum += BigInt(p.share) * BigInt(refundable);
        break;
      }
      case PotState.Locked:
      case PotState.PayoutRequested:
        sum += BigInt(p.total);
        break;
      default:
        break; // Released: nothing left in the contract.
    }
  }
  return sum;
}

/**
 * Pot counts by plain state. "closed" is Frozen, which the UI shows as Frozen or Expired. A Locked pot past
 * its request window is still labelled Locked in potState.ts, so it is not counted as closed here.
 */
export function stateCounts(pots: DashboardPot[]): { funding: number; locked: number; payout: number; released: number; closed: number } {
  const counts = { funding: 0, locked: 0, payout: 0, released: 0, closed: 0 };
  for (const p of pots) {
    if (p.state === PotState.Funding) counts.funding++;
    else if (p.state === PotState.Locked) counts.locked++;
    else if (p.state === PotState.PayoutRequested) counts.payout++;
    else if (p.state === PotState.Released) counts.released++;
    else if (p.state === PotState.Frozen) counts.closed++;
  }
  return counts;
}

/** A row from pot_events. The table has no timestamp column, so none is shown. */
export type ActivityEvent = { id: number | string; pot_id: string; event_name: string; args: Record<string, unknown> };
export type ActivityItem = { id: string; potId: string; potTitle: string; text: string; tone: 'neutral' | 'money' | 'warn' | 'bad' };

function idValue(id: number | string): bigint {
  try {
    return BigInt(String(id));
  } catch {
    return BigInt(-1);
  }
}

function usdcOrNull(raw: unknown): string | null {
  if (raw === null || raw === undefined || raw === '') return null;
  try {
    return usdc(String(raw));
  } catch {
    return null;
  }
}

type Described = { text: string; tone: ActivityItem['tone'] };

/**
 * One plain sentence per known event. Verbs are past tense so they read the same after "You" or "A member".
 * Returns null for event names this module does not know, so the caller skips them.
 */
function describe(e: ActivityEvent, me: string | null, names: Record<string, string>): Described | null {
  const args = e.args ?? {};
  const who = (addr: unknown): string => {
    const a = typeof addr === 'string' ? addr.toLowerCase() : '';
    if (me !== null && a === me) return 'You';
    return a && names[a] ? names[a] : 'A member';
  };
  const amount = usdcOrNull(args.amount);

  switch (e.event_name) {
    case 'PotCreated':
      return { text: `${who(args.organizer)} created this pot`, tone: 'neutral' };
    case 'Paid':
      return { text: `${who(args.member)} paid ${amount ?? 'their share'}`, tone: 'money' };
    case 'Locked':
      return { text: 'Everyone paid, so the money is locked', tone: 'money' };
    case 'SeatSwapped':
      return { text: `${who(args.leaver)} left and ${who(args.replacement)} took the seat`, tone: 'neutral' };
    case 'Refunded':
      return { text: amount ? `${who(args.member)} got a refund of ${amount}` : `${who(args.member)} got a refund`, tone: 'money' };
    case 'PayoutRequested':
      return { text: 'The organizer requested the payout', tone: 'warn' };
    case 'Objected':
      return { text: `${who(args.member)} objected to the payout`, tone: 'warn' };
    case 'Released':
      return { text: `${who(args.organizer)} received ${amount ?? 'the payout'}`, tone: 'money' };
    case 'Expired':
      return { text: 'The request window ended, so the pot expired. Members who paid can take their money back', tone: 'bad' };
    case 'Frozen':
      return { text: 'Enough members objected, so the payout is frozen', tone: 'bad' };
    default:
      return null;
  }
}

/**
 * Recent pot activity, newest first by event id, capped at `limit`. Unknown event names are skipped.
 * `names` maps lowercase addresses to the name to show for that member. Without an entry the actor shows as "A member".
 */
export function activityItems(
  events: ActivityEvent[],
  potTitles: Record<string, string>,
  myAddress: string | null,
  limit = 12,
  names: Record<string, string> = {},
): ActivityItem[] {
  const me = myAddress ? myAddress.toLowerCase() : null;
  const ordered = [...events].sort((a, b) => {
    const av = idValue(a.id);
    const bv = idValue(b.id);
    return av > bv ? -1 : av < bv ? 1 : 0;
  });
  const out: ActivityItem[] = [];
  for (const e of ordered) {
    if (out.length >= limit) break;
    const described = describe(e, me, names);
    if (!described) continue;
    out.push({
      id: String(e.id),
      potId: e.pot_id,
      potTitle: potTitles[e.pot_id] ?? `Pot #${e.pot_id}`,
      text: described.text,
      tone: described.tone,
    });
  }
  return out;
}
