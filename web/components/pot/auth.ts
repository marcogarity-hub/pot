/** Only same-origin relative paths survive sign-in; anything else becomes "/". */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000- ]/.test(next)) return '/';
  return next;
}

/** emailRedirectTo for Supabase magic links (spec Decision 4). */
export function magicLinkRedirect(appUrl: string, next: string | null | undefined): string {
  return `${appUrl.replace(/\/+$/, '')}/api/wallet/callback?next=${encodeURIComponent(safeNext(next))}`;
}

/** `isActiveMember`: the invite's wallet is an active pot_members row (false after a swap). */
export type InviteLookup = { potId: string; invited: boolean; isOrganizer: boolean; isActiveMember: boolean } | null;
export type InviteOutcome = { kind: 'pot'; potId: string } | { kind: 'not-invited' } | { kind: 'not-found' } | { kind: 'left' };

export function resolveInvite(lookup: InviteLookup): InviteOutcome {
  if (!lookup) return { kind: 'not-found' };
  if (lookup.isOrganizer) return { kind: 'pot', potId: lookup.potId };
  if (lookup.invited && lookup.isActiveMember) return { kind: 'pot', potId: lookup.potId };
  // The invite row survives a swap, so an invite without an active seat means the member left.
  if (lookup.invited) return { kind: 'left' };
  return { kind: 'not-invited' };
}
