import { createServerSupabase } from '@/lib/supabase/server';
import { claimUser } from '@/lib/circle/identity';
function safeNext(input: string | null): string {
  if (!input || !input.startsWith('/') || input.startsWith('//') || /[\\\u0000-\u0020]/.test(input)) return '/';
  try {
    const decoded = decodeURIComponent(input);
    if (decoded.startsWith('//') || /[\\\u0000-\u0020]/.test(decoded)) return '/';
  } catch { return '/'; }
  return input;
}
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  if (!code) return Response.json({ error: 'Missing authorization code' },{status:400});
  const supabase = await createServerSupabase();
  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) return Response.json({ error: 'Sign-in failed' },{status:401});
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return Response.json({ error: 'Sign-in failed' },{status:401});
  try { await claimUser(data.user.id,data.user.email); }
  catch { return Response.json({ error: 'Wallet provisioning pending. Please retry shortly.' },{status:503}); }
  return Response.redirect(new URL(safeNext(url.searchParams.get('next')),url.origin),303);
}
