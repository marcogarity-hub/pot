/** Only same-origin relative paths survive sign-in; anything else becomes "/". */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000- ]/.test(next)) return '/';
  return next;
}

export type OAuthProvider = 'google' | 'apple';
const OAUTH_PROVIDERS: readonly OAuthProvider[] = ['google', 'apple'];

/**
 * Parses NEXT_PUBLIC_AUTH_PROVIDERS (for example "google" or "google,apple") into the providers whose buttons
 * show on the sign-in screen. Unknown names are dropped and unset means none, so a provider appears only after
 * it has been enabled in Supabase and listed here. The order is always google, then apple.
 */
export function parseOAuthProviders(raw: string | undefined): OAuthProvider[] {
  const wanted = new Set((raw ?? '').split(',').map(name => name.trim().toLowerCase()));
  return OAUTH_PROVIDERS.filter(provider => wanted.has(provider));
}

/** emailRedirectTo for Supabase magic links (spec Decision 4). Also the redirectTo for Google/Apple sign-in. */
export function magicLinkRedirect(appUrl: string, next: string | null | undefined): string {
  return `${appUrl.replace(/\/+$/, '')}/api/wallet/callback?next=${encodeURIComponent(safeNext(next))}`;
}

/**
 * `memberState` comes from the invite's pot_members row: 'active', 'inactive' (the member was swapped out),
 * or 'unknown' (no row yet, e.g. the QuickNode projection hasn't caught up). Only 'inactive' means the member left.
 */
export type MemberState = 'active' | 'inactive' | 'unknown';
export type InviteLookup = { potId: string; invited: boolean; isOrganizer: boolean; memberState: MemberState } | null;
export type InviteOutcome = { kind: 'pot'; potId: string } | { kind: 'not-invited' } | { kind: 'not-found' } | { kind: 'left' };

export function resolveInvite(lookup: InviteLookup): InviteOutcome {
  if (!lookup) return { kind: 'not-found' };
  if (lookup.isOrganizer) return { kind: 'pot', potId: lookup.potId };
  if (lookup.invited && lookup.memberState === 'inactive') return { kind: 'left' };
  if (lookup.invited) return { kind: 'pot', potId: lookup.potId };
  return { kind: 'not-invited' };
}
