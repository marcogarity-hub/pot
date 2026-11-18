import { postJson } from './api';

/** Lane 2 contract: POST /api/pots/reconcile, with exactly one of the two ids. */
export type ReconcileInput = { title: string; memberEmails: string[] }
  & ({ circleTransactionId: string } | { transactionHash: string });

export type ReconcileOutcome =
  | { kind: 'created'; potId: string; inviteToken: string }
  | { kind: 'not-created' }
  | { kind: 'stop'; message: string }
  | { kind: 'timeout' }
  | { kind: 'cancelled' };

export const RECONCILE_INTERVAL_MS = 5_000;
export const RECONCILE_TIMEOUT_MS = 120_000;

export const STOP_MESSAGES: Record<number, string> = {
  422: "The plan's details don't match what was submitted, so we couldn't finish it. Don't submit it again. Refresh your plan list later to check.",
  403: "We couldn't finish this plan with your account. Don't submit it again. Refresh your plan list later to check.",
  401: 'Your sign-in expired. Sign in again, then refresh your plan list. Don\'t submit the plan again until you\'ve checked.',
};
export const TIMEOUT_MESSAGE = "We're still finishing your plan. Don't submit it again. Refresh your plan list in a few minutes to see it.";

/**
 * Polls reconcile until the pot is recorded, the server says it was never created, a terminal
 * error comes back, or the time budget runs out. 202, 503 and network errors are retried.
 */
export async function reconcilePot(input: ReconcileInput, options: {
  isCancelled(): boolean;
  intervalMs?: number;
  timeoutMs?: number;
}): Promise<ReconcileOutcome> {
  const intervalMs = options.intervalMs ?? RECONCILE_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? RECONCILE_TIMEOUT_MS;
  const started = Date.now();
  for (;;) {
    const res = await postJson<{ potId: string; inviteToken: string }>('/api/pots/reconcile', input);
    if (res.ok && (res.status === 200 || res.status === 201)) {
      return { kind: 'created', potId: String(res.data.potId), inviteToken: String(res.data.inviteToken) };
    }
    if (!res.ok && res.status === 409) return { kind: 'not-created' };
    if (!res.ok && STOP_MESSAGES[res.status]) return { kind: 'stop', message: STOP_MESSAGES[res.status] };
    if (Date.now() - started >= timeoutMs) return { kind: 'timeout' };
    await new Promise(resolve => setTimeout(resolve, intervalMs));
    if (options.isCancelled()) return { kind: 'cancelled' };
  }
}
