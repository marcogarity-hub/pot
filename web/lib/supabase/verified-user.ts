import type { SupabaseClient } from '@supabase/supabase-js';

export type VerifiedUser = { id: string; email: string };

/**
 * Sign-in methods that do not prove the person controls the email address. The app only ever signs people
 * in with an emailed one-time code (or the emailed link), whose sessions carry method "otp". A password
 * session can exist for someone else's address: an attacker can pre-register a victim's email with their own
 * password, and when the victim later signs in with a code the account becomes confirmed while the
 * attacker's password keeps working. Such sessions must never act for the address.
 */
const BLOCKED_METHODS = new Set(['password', 'anonymous']);

/** Reads the authentication methods (amr claim) from an access token without trusting it for identity. */
export function authMethods(accessToken: string): string[] | null {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1] ?? '', 'base64url').toString('utf8')) as { amr?: unknown };
    if (!Array.isArray(payload.amr)) return null;
    const methods = payload.amr.map(entry => (entry && typeof entry === 'object' ? (entry as { method?: unknown }).method : entry));
    return methods.every(m => typeof m === 'string') ? (methods as string[]) : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in user, only if Supabase vouches for the session AND the email is confirmed AND the session was
 * not opened with a password or anonymously. Returns null otherwise. Use this instead of auth.getUser() in
 * every route that acts for the user's email (wallet lookup, claiming, paying).
 */
export async function getVerifiedUser(supabase: SupabaseClient): Promise<VerifiedUser | null> {
  const { data, error } = await supabase.auth.getUser();
  const user = data?.user;
  if (error || !user?.email || !user.email_confirmed_at) return null;
  // getUser() has just verified this session with Supabase; the token is read only for its method list.
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return null;
  const methods = authMethods(token);
  if (!methods || methods.length === 0) return null; // unknown means refuse
  if (methods.some(method => BLOCKED_METHODS.has(method))) return null;
  return { id: user.id, email: user.email };
}
