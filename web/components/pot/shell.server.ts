import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DASHBOARD_POT_COLUMNS, needsYou, type DashboardPot } from './dashboardModel';
import type { ShellPot } from './AppSidebar';
import { toShellPots } from './shellModel';

/** What the signed-in frame needs on any page: who is signed in and their pots for the sidebar. RLS applies. */
export async function loadShell(
  supabase: SupabaseClient,
  user: { id: string; email: string },
  nowMs: number,
): Promise<{ me: { name: string | null; email: string }; pots: ShellPot[] }> {
  const [{ data: potRows }, { data: me }] = await Promise.all([
    supabase.from('pot_status').select(DASHBOARD_POT_COLUMNS).order('created_at', { ascending: false }),
    supabase.from('users').select('wallet_address,display_name').eq('auth_user_id', user.id).maybeSingle(),
  ]);
  const pots = (potRows ?? []) as unknown as DashboardPot[];
  const row = me as { wallet_address: string | null; display_name: string | null } | null;
  const queue = needsYou(pots, row?.wallet_address ?? null, nowMs);
  return { me: { name: row?.display_name ?? null, email: user.email }, pots: toShellPots(pots, queue) };
}
