import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/admin';
import type { InviteLookup } from './auth';

/** Resolves an invite token with the admin client (the caller isn't a member yet, so RLS would hide it). */
export async function lookupInvite(token: string, email: string): Promise<InviteLookup> {
  const db = createAdminSupabase();
  const normalized = email.trim().toLowerCase();
  const { data: meta } = await db.from('pot_meta').select('pot_id::text').eq('invite_token', token).maybeSingle();
  if (!meta) return null;
  const potId = (meta as { pot_id: string }).pot_id;
  const [{ data: invite }, { data: user }, { data: pot }] = await Promise.all([
    db.from('pot_invites').select('address').eq('pot_id', potId).eq('email', normalized).limit(1).maybeSingle(),
    db.from('users').select('wallet_address').eq('email', normalized).maybeSingle(),
    db.from('pots').select('organizer_address').eq('pot_id', potId).maybeSingle(),
  ]);
  const wallet = (user as { wallet_address: string | null } | null)?.wallet_address?.toLowerCase();
  const organizer = (pot as { organizer_address: string } | null)?.organizer_address?.toLowerCase();
  return { potId, invited: !!invite, isOrganizer: !!wallet && wallet === organizer };
}

/** Title for the signed-out invite screen. The token itself is the secret. */
export async function inviteTitle(token: string): Promise<string | null | undefined> {
  const { data } = await createAdminSupabase().from('pot_meta').select('title').eq('invite_token', token).maybeSingle();
  return data ? (data as { title: string | null }).title : undefined;
}
