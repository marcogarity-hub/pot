import { z } from 'zod';
import { formatUnits, parseUnits } from 'viem';
import type { CreatePotBody } from '@/app/api/pots/schema';

export const MAX_MEMBERS = 20;
export const OBJECTION_MIN = 60;
export const OBJECTION_MAX = 7 * 24 * 3600;
export const REQUEST_MIN = 60;
export const REQUEST_MAX = 30 * 24 * 3600;
/** Longest allowed time from now until the pay-in deadline, in seconds. Matches the API cap. */
export const DEADLINE_MAX = 365 * 24 * 3600;

const AMOUNT = /^\d+(\.\d{1,18})?$/;
const emailSchema = z.email();

export type CreateErrors = Partial<Record<keyof CreatePotBody, string>>;
export type CreateResult = { ok: true; share: string } | { ok: false; errors: CreateErrors };

export const normalizeEmail = (e: string) => e.trim().toLowerCase();

/** Mirrors the API's createPotSchema so the form can block bad input before submit. */
export function validateCreate(input: CreatePotBody, now: Date): CreateResult {
  const errors: CreateErrors = {};
  const emails = input.memberEmails.map(normalizeEmail);
  const n = emails.length;

  if (!input.title.trim()) errors.title = 'Give the pot a name';
  else if (input.title.trim().length > 120) errors.title = 'Keep the name under 120 characters';

  if (n === 0) errors.memberEmails = 'Add at least one member';
  else if (n > MAX_MEMBERS) errors.memberEmails = `A pot can have at most ${MAX_MEMBERS} members`;
  else if (emails.some(e => !emailSchema.safeParse(e).success)) errors.memberEmails = 'Check the member emails';
  else if (new Set(emails).size !== n) errors.memberEmails = 'Each member email can only appear once';

  let totalUnits: bigint | null = null;
  if (!AMOUNT.test(input.total.trim())) errors.total = 'Enter a USDC amount, like 2400 or 12.50';
  else {
    totalUnits = parseUnits(input.total.trim(), 18);
    if (totalUnits <= BigInt(0)) errors.total = 'Total must be more than 0';
    else if (n > 0 && totalUnits % BigInt(n) !== BigInt(0)) errors.total = 'Total must divide evenly by the number of members';
  }

  const deadlineMs = Date.parse(input.deadline);
  if (Number.isNaN(deadlineMs)) errors.deadline = 'Pick a deadline';
  else {
    const deadlineSeconds = Math.floor(deadlineMs / 1000);
    const nowSeconds = Math.floor(now.getTime() / 1000);
    if (deadlineSeconds <= nowSeconds) errors.deadline = 'Deadline must be in the future';
    else if (deadlineSeconds > nowSeconds + DEADLINE_MAX) errors.deadline = 'Deadline must be within one year';
  }

  if (!Number.isInteger(input.threshold) || input.threshold < 1 || (n > 0 && input.threshold > n)) {
    errors.threshold = `Threshold must be between 1 and ${Math.max(n, 1)}`;
  }

  const ow = input.objectionWindowSeconds;
  if (!Number.isInteger(ow) || ow < OBJECTION_MIN || ow > OBJECTION_MAX) errors.objectionWindowSeconds = 'Objection window must be between 1 minute and 7 days';
  const rw = input.requestWindowSeconds;
  if (!Number.isInteger(rw) || rw < REQUEST_MIN || rw > REQUEST_MAX) errors.requestWindowSeconds = 'Payout request window must be between 1 minute and 30 days';

  if (Object.keys(errors).length > 0 || totalUnits === null) return { ok: false, errors };
  return { ok: true, share: formatUnits(totalUnits / BigInt(n), 18) };
}

/** Per-member share as a decimal string, or null if the total doesn't split evenly. */
export function deriveShare(total: string, members: number): string | null {
  const t = total.trim();
  if (members < 1 || !AMOUNT.test(t)) return null;
  const units = parseUnits(t, 18);
  if (units <= BigInt(0) || units % BigInt(members) !== BigInt(0)) return null;
  return formatUnits(units / BigInt(members), 18);
}
