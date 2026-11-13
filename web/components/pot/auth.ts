/** Only same-origin relative paths survive sign-in; anything else becomes "/". */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000- ]/.test(next)) return '/';
  return next;
}

/** emailRedirectTo for Supabase magic links (spec Decision 4). */
export function magicLinkRedirect(appUrl: string, next: string | null | undefined): string {
  return `${appUrl.replace(/\/+$/, '')}/api/wallet/callback?next=${encodeURIComponent(safeNext(next))}`;
}

export type InviteLookup = { potId: string; invited: boolean; isOrganizer: boolean } | null;
export type InviteOutcome = { kind: 'pot'; potId: string } | { kind: 'not-invited' } | { kind: 'not-found' };

export function resolveInvite(lookup: InviteLookup): InviteOutcome {
  if (!lookup) return { kind: 'not-found' };
  if (lookup.invited || lookup.isOrganizer) return { kind: 'pot', potId: lookup.potId };
  return { kind: 'not-invited' };
}
