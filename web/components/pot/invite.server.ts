import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { formatUnits } from 'viem';
import type { InviteLookup, MemberState } from './auth';

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
  const inviteAddress = (invite as { address: string } | null)?.address?.toLowerCase();
  let memberState: MemberState = 'unknown';
  if (inviteAddress) {
    // pot_invites keeps its row after a swap. Read the seat without an `active` filter, so that
    // 'inactive' (swapped out) is distinguishable from 'no row yet' (projection lag).
    const { data: member } = await db.from('pot_members').select('active')
      .eq('pot_id', potId).eq('address', inviteAddress).maybeSingle();
    if (member) memberState = (member as { active: boolean }).active ? 'active' : 'inactive';
  }
  return { potId, invited: !!invite, isOrganizer: !!wallet && wallet === organizer, memberState };
}

/** Title for the signed-out invite screen. The token itself is the secret. */
export async function inviteTitle(token: string): Promise<string | null | undefined> {
  const { data } = await createAdminSupabase().from('pot_meta').select('title').eq('invite_token', token).maybeSingle();
  return data ? (data as { title: string | null }).title : undefined;
}

/** Pot name, share and organizer for the join preview. The organizer shows by name when they set one, else by the email they invited with. Any field the projection hasn't filled is null. */
export async function potSummary(potId: string): Promise<{ title: string | null; amount: string | null; organizerEmail: string | null; organizerName: string | null }> {
  const db = createAdminSupabase();
  const [{ data: status }, { data: meta }] = await Promise.all([
    db.from('pot_status').select('share::text,organizer_address').eq('pot_id', potId).maybeSingle(),
    db.from('pot_meta').select('title').eq('pot_id', potId).maybeSingle(),
  ]);
  const row = status as { share: string; organizer_address: string } | null;
  const organizer = row?.organizer_address
    ? ((await db.from('users').select('email,display_name').ilike('wallet_address', row.organizer_address).maybeSingle()).data as { email: string; display_name: string | null } | null)
    : null;
  return {
    title: (meta as { title: string | null } | null)?.title ?? null,
    amount: row?.share ? formatUnits(BigInt(row.share), 18) : null,
    organizerEmail: organizer?.email ?? null,
    organizerName: organizer?.display_name ?? null,
  };
}
