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

export function toHttp(error: unknown): Response {
  if (error instanceof CircleTimeoutError) return Response.json({ error: 'TransactionPending', message: 'Your transaction is still processing. Refresh in a minute before retrying.', circleTransactionId: error.circleTransactionId }, { status: 502 });
  if (error instanceof PotConfigurationError) return Response.json({ error: 'PotUnavailable', message: error.message }, { status: 503 });
  if (error instanceof PotNotFoundError) return Response.json({ error: 'PotNotFound' }, { status: 404 });
  if (error instanceof PotRevertError) {
    return Response.json({ error: error.code, message: messages[error.code] ?? 'That action could not be completed.' }, { status: 409 });
  }
  return Response.json({ error: 'InternalServerError', message: 'The request could not be completed.' }, { status: 500 });
}
