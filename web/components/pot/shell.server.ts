import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/** What the signed-in frame needs on any page: who is signed in, for the account menu. RLS applies. */
export async function loadShell(
  supabase: SupabaseClient,
  user: { id: string; email: string },
): Promise<{ me: { name: string | null; email: string } }> {
  const { data } = await supabase.from('users').select('display_name').eq('auth_user_id', user.id).maybeSingle();
  const row = data as { display_name: string | null } | null;
  return { me: { name: row?.display_name ?? null, email: user.email } };
}
