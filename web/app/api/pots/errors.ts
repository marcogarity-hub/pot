import { PotRevertError } from '@/lib/circle/tx';

const messages: Record<string, string> = {
  AlreadyPaid: "You've already paid into this pot.",
  DeadlinePassed: 'The deadline has passed.',
  WindowClosed: 'The objection window has closed.',
  FormerMember: 'That person has already left this pot.',
};

export function toHttp(error: unknown): Response {
  if (error instanceof PotRevertError) {
    return Response.json({ error: error.code, message: messages[error.code] ?? error.code }, { status: 409 });
  }
  return Response.json({ error: 'InternalServerError', message: 'The request could not be completed.' }, { status: 500 });
}
