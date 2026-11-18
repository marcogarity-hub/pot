import { PotState } from '@/lib/pot/chain';
import { formatDollars } from '@/lib/format/money';
import type { Face } from './Faces';

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
  /** Who the row is about: the members still to pay, or the organizer who asked for the payout. */
  faces?: Face[];
  /** The moment this action is waiting on (ms since epoch), so the soonest one can be picked. */
  dueAt?: number;
};

const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;

const ms = (iso: string | null | undefined): number => (iso ? Date.parse(iso) : NaN);

/** Plain time left: "5 h", "3 days", "less than a minute". */
export function formatDuration(remainingMs: number): string {
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

/** Money as dollars, e.g. "$210". Amounts are 18-decimal base units. */
function usdc(raw: string): string {
  return formatDollars(raw);
}

const faceOf = (m: DashboardMember, seat: number, paid: boolean): Face => ({ seat, name: m.name, email: m.email, paid });

function nextAction(p: DashboardPot, me: string, now: number): QueueItem | null {
  const base = { potId: p.pot_id, potTitle: p.title ?? `Pot #${p.pot_id}`, href: `/pots/${p.pot_id}` };
  const isOrganizer = p.organizer_address.toLowerCase() === me;
  const mineIndex = p.members.findIndex(m => m.active && m.address.toLowerCase() === me);
  const mine = mineIndex >= 0 ? p.members[mineIndex] : undefined;
  const canRefund = !!mine && mine.has_paid && !mine.has_refunded;
  const refund = (): QueueItem => ({
    ...base, action: 'refund', label: 'Claim your refund',
    hint: `Get your ${usdc(p.share)} back`, urgency: 60,
    faces: mine ? [faceOf(mine, mineIndex + 1, true)] : [],
  });
  const organizerIndex = p.members.findIndex(m => m.address.toLowerCase() === p.organizer_address.toLowerCase());
  const organizerFaces = (): Face[] => (organizerIndex >= 0 ? [faceOf(p.members[organizerIndex], organizerIndex + 1, true)] : []);
  const unpaidFaces = (): Face[] => p.members
    .map((m, i) => ({ m, seat: i + 1 }))
    .filter(({ m }) => m.active && !m.has_paid)
    .map(({ m, seat }) => faceOf(m, seat, false));

  switch (p.state) {
    case PotState.Funding: {
      const deadline = ms(p.deadline);
      if (now < deadline) {
        if (mine && !mine.has_paid) {
          const left = deadline - now;
          return {
            ...base, action: 'pay', label: 'Pay your share',
            hint: `${usdc(p.share)}, closes in ${formatDuration(left)}`, urgency: 70 + timeBoost(left),
            faces: unpaidFaces(), dueAt: deadline,
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
      return {
        ...base, action: 'request-payout', label: 'Request the payout', hint, urgency: 50, faces: organizerFaces(),
        dueAt: left > 0 ? windowEnds : undefined,
      };
    }
    case PotState.PayoutRequested: {
      const eligibleAt = ms(p.release_eligible_at);
      if (now < eligibleAt) {
        if (mine && !mine.has_objected) {
          const left = eligibleAt - now;
          return {
            ...base, action: 'review-payout', label: 'Review the payout request',
            hint: `${formatDuration(left)} left to object`, urgency: 80 + timeBoost(left),
            faces: organizerFaces(), dueAt: eligibleAt,
          };
        }
        return null;
      }
      if (p.objections_count < p.threshold) {
        return {
          ...base, action: 'finalize', label: 'Finalize the payout',
          hint: 'The objection window has ended', urgency: 95, faces: organizerFaces(),
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

/** Money inside the contract for one pot, in 18-decimal base units. */
function heldIn(p: DashboardPot): bigint {
  switch (p.state) {
    case PotState.Funding:
    case PotState.Frozen: {
      // Still refundable: a paid share sits in the contract until its owner takes it back.
      const refundable = p.members.filter(m => m.has_paid && !m.has_refunded).length;
      return BigInt(p.share) * BigInt(refundable);
    }
    case PotState.Locked:
    case PotState.PayoutRequested:
      return BigInt(p.total);
    default:
      return BigInt(0); // Released: nothing left in the contract.
  }
}

/** Money inside the contract across these pots, in 18-decimal base units. */
export function heldAmount(pots: DashboardPot[]): bigint {
  return pots.reduce((sum, p) => sum + heldIn(p), BigInt(0));
}

/** How many of these pots still hold money. */
export function heldPotCount(pots: DashboardPot[]): number {
  return pots.filter(p => heldIn(p) > BigInt(0)).length;
}

/** The first word of the display name, or null when no name is set. Never derived from the email. */
export function firstName(name: string | null): string | null {
  const word = name?.trim().split(/\s+/)[0] ?? '';
  return word || null;
}

export type NeedGroup = { action: QueueItem['action']; items: QueueItem[]; soonest: QueueItem };

/** Needs-you items grouped by action type, in the order each type first appears (most urgent first). */
export function groupNeeds(queue: QueueItem[]): NeedGroup[] {
  const byAction = new Map<QueueItem['action'], QueueItem[]>();
  for (const item of queue) {
    const list = byAction.get(item.action);
    if (list) list.push(item);
    else byAction.set(item.action, [item]);
  }
  return [...byAction].map(([action, items]) => ({ action, items, soonest: soonestOf(items) }));
}

/** The item whose deadline is nearest. Items with no deadline only win when none has one. */
function soonestOf(items: QueueItem[]): QueueItem {
  return items.reduce((best, item) =>
    item.dueAt !== undefined && (best.dueAt === undefined || item.dueAt < best.dueAt) ? item : best);
}

export type ClosingPot = { potId: string; title: string; paid: number; members: number; deadlineAt: number };

/** Pots still Funding whose deadline falls within `windowMs` of now, soonest first. */
export function closingSoon(pots: DashboardPot[], now: number, windowMs = 7 * DAY_MS): ClosingPot[] {
  return pots
    .filter(p => p.state === PotState.Funding)
    .map(p => ({
      potId: p.pot_id,
      title: p.title ?? `Pot #${p.pot_id}`,
      paid: p.members.filter(m => m.active && m.has_paid).length,
      members: p.members.filter(m => m.active).length,
      deadlineAt: ms(p.deadline),
    }))
    .filter(c => c.deadlineAt > now && c.deadlineAt - now <= windowMs)
    .sort((a, b) => a.deadlineAt - b.deadlineAt || a.potId.localeCompare(b.potId));
}
