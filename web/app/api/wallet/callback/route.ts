import { createServerSupabase } from '@/lib/supabase/server';
import { claimUser } from '@/lib/circle/identity';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
function safeNext(input: string | null): string {
  if (!input || !input.startsWith('/') || input.startsWith('//') || /[\\\u0000- ]/.test(input)) return '/';
  try {
    const decoded = decodeURIComponent(input);
    if (decoded.startsWith('//') || /[\\\u0000- ]/.test(decoded)) return '/';
  } catch { return '/'; }
  return input;
}
const PROVIDER_ERROR_PARAMS = ['error', 'error_code', 'error_description'];
const MAX_SUPABASE_CODE_LENGTH = 40;
function shortCode(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 && value.length <= MAX_SUPABASE_CODE_LENGTH ? value : null;
}
/** Logs one redacted line (reason and short Supabase code only) and sends the user back to the sign-in page. */
function signInFailed(request: Request, reason: 'missing_code' | 'provider_error' | 'exchange_failed' | 'unverified_session', supabaseCode: string | null, next: string | null): Response {
  console.error('[api/wallet/callback] sign-in failed:', JSON.stringify({ reason, supabaseCode }));
  const target = new URL('/sign-in', request.url);
  target.searchParams.set('error', 'link');
  if (next) target.searchParams.set('next', next);
  return Response.redirect(target, 302);
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextParam = url.searchParams.get('next');
  const validNext = nextParam !== null && safeNext(nextParam) === nextParam ? nextParam : null;
  if (PROVIDER_ERROR_PARAMS.some(p => url.searchParams.has(p))) {
    return signInFailed(request, 'provider_error', shortCode(url.searchParams.get('error_code')), validNext);
  }
  const code = url.searchParams.get('code');
  if (!code) return signInFailed(request, 'missing_code', null, validNext);
  const supabase = await createServerSupabase();
  let exchanged;
  try {
    exchanged = await supabase.auth.exchangeCodeForSession(code);
  } catch {
    return signInFailed(request, 'exchange_failed', null, validNext);
  }
  if (exchanged.error) return signInFailed(request, 'exchange_failed', shortCode(exchanged.error.code), validNext);
  // Only a session Supabase vouches for, with a confirmed email and an OTP (not password) method, may claim a wallet.
  const user = await getVerifiedUser(supabase);
  if (!user) return signInFailed(request, 'unverified_session', null, validNext);
  try { await claimUser(user.id,user.email); }
  catch { return Response.json({ error: 'Wallet provisioning pending. Please retry shortly.' },{status:503}); }
  return Response.redirect(new URL(safeNext(url.searchParams.get('next')),url.origin),303);
}
