import { PotConfigurationError } from '@/lib/circle/contract';
import { PotNotFoundError } from '@/lib/circle/read';
import { CircleTimeoutError, PotRevertError } from '@/lib/circle/tx';

export const messages: Record<string, string> = {
  AlreadyPaid: "You've already paid into this pot.",
  DeadlinePassed: 'The deadline has passed.',
  WindowClosed: 'The objection window has closed.',
  FormerMember: 'That person has already left this pot.',
  WrongState: "That action isn't available at this stage of the pot.",
  NotMember: "You're not part of this pot.", NotOrganizer: 'Only the organizer can do that.',
  WrongAmount: "That isn't your share of this pot.", NotRefundable: "There's nothing for you to refund here.",
  AlreadyRefunded: "You've already been refunded.", WindowOpen: 'The objection window is still open.',
  AlreadyObjected: "You've already objected.", RequestWindowOpen: 'The organizer still has time to request the payout.',
  DeadlineNotPassed: "The deadline hasn't passed yet.", TransferFailed: 'The payment was rejected by the receiving address.',
  InvalidParams: 'Check the pot details and try again.', ZeroAddress: 'A wallet address is missing or invalid.',
  DuplicateMember: 'Each member must have a different email address.', NotImplemented: 'That action is not available yet.',
  ReentrancyGuardReentrantCall: 'That action is already being processed.',
  RequestWindowClosed: 'The time to request the payout has passed.',
};

const fieldLabels: Record<string, string> = { title: 'Name', total: 'Total', memberEmails: 'Members', deadline: 'Deadline', threshold: 'Objection threshold', objectionWindowSeconds: 'Objection window', requestWindowSeconds: 'Request window' };
export function validationMessage(issue: { path: PropertyKey[]; message: string }): string {
  const key = issue.path[0];
  if (key === undefined) return issue.message;
  const label = fieldLabels[String(key)] ?? String(key);
  return `${label}: ${issue.message}`;
}

export type DescribedError = { name: string; message: string; status?: number; code?: string | number };

const SECRET_ENV = ['CIRCLE_API_KEY', 'CIRCLE_ENTITY_SECRET', 'SUPABASE_SECRET_KEY', 'QUICKNODE_STREAM_TOKEN'];

function redact(text: string): string {
  let out = text;
  for (const name of SECRET_ENV) {
    const value = process.env[name];
    if (value && value.length >= 8) out = out.split(value).join('[redacted]');
  }
  return out.replace(/Bearer\s+\S+/g, '[redacted]').replace(/TEST_API_KEY:\S+|LIVE_API_KEY:\S+/g, '[redacted]');
}

function pickName(error: object): string {
  const ctor = (error as { constructor?: { name?: unknown } }).constructor?.name;
  const name = (error as { name?: unknown }).name;
  for (const candidate of [ctor, name]) {
    if (typeof candidate === 'string' && candidate !== '' && candidate !== 'Object' && candidate !== 'Error') return candidate;
  }
  return 'Error';
}

// Whitelist only: never the error object, stack, request config, headers, URLs or response bodies.
export function describeError(error: unknown): DescribedError {
  if (error === null || typeof error !== 'object') {
    const text = typeof error === 'string' ? error : '';
    return { name: 'UnknownError', message: redact(text).slice(0, 300) };
  }
  const record = error as { message?: unknown; status?: unknown; code?: unknown; response?: { status?: unknown; data?: { code?: unknown } } };
  const message = typeof record.message === 'string' ? record.message : '';
  const status = typeof record.status === 'number' ? record.status : typeof record.response?.status === 'number' ? record.response.status : undefined;
  const rawCode = record.code ?? record.response?.data?.code;
  const code = typeof rawCode === 'string' || typeof rawCode === 'number' ? rawCode : undefined;
  const result: DescribedError = { name: pickName(error), message: redact(message).slice(0, 300) };
  if (status !== undefined) result.status = status;
  if (code !== undefined) result.code = code;
  return result;
}

// One safe line per failure, for Vercel logs.
export function logApiError(context: string, error: unknown): void {
  console.error(`[api/pots] ${context}: ${JSON.stringify(describeError(error))}`);
}

export function toHttp(error: unknown): Response {
  if (error instanceof CircleTimeoutError) return Response.json({ error: 'TransactionPending', message: 'Your transaction is still processing. Refresh in a minute before retrying.', circleTransactionId: error.circleTransactionId }, { status: 502 });
  if (error instanceof PotConfigurationError) return Response.json({ error: 'PotUnavailable', message: error.message }, { status: 503 });
  if (error instanceof PotNotFoundError) return Response.json({ error: 'PotNotFound' }, { status: 404 });
  if (error instanceof PotRevertError) {
    return Response.json({ error: error.code, message: messages[error.code] ?? 'That action could not be completed.' }, { status: 409 });
  }
  logApiError('internal error', error);
  return Response.json({ error: 'InternalServerError', message: 'The request could not be completed.' }, { status: 500 });
}
