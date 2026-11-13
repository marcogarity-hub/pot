import type { Hex } from 'viem';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { createWallet } from './wallets';
import { prefund, PrefundRefusedError } from '../relayer';
import { validAddress } from './contract';
export function normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
export type WalletUser = { id: string; wallet_address: Hex; circle_wallet_id: string };
function ready(row: Record<string, unknown> | null): row is WalletUser {
  return !!row && typeof row.id === 'string' && typeof row.circle_wallet_id === 'string' && typeof row.wallet_address === 'string';
}
export async function ensureUser(input: string): Promise<WalletUser> {
  const email = normalizeEmail(input);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email');
  const db = createAdminSupabase();
  // INSERT ... ON CONFLICT DO NOTHING RETURNING: database arbitrates ownership,
  // including separate server instances. No in-process lock can replace this.
  const inserted = await db.from('users').upsert({ email, claimed: false }, { onConflict: 'email', ignoreDuplicates: true }).select('id,email,created_at,circle_wallet_id,wallet_address').maybeSingle();
  if (inserted.error) throw new Error('Could not reserve wallet identity');
  let reservation = inserted.data;
  if (!reservation) {
    const existing = await db.from('users').select('id,email,created_at,circle_wallet_id,wallet_address').eq('email', email).maybeSingle();
    if (existing.error) throw new Error('Could not read wallet mapping');
    const row = existing.data;
    const created = typeof row?.created_at === 'string' ? Date.parse(row.created_at) : NaN;
    if (row && row.circle_wallet_id == null && Number.isFinite(created) && Date.now() - created > 120_000) {
      const now = new Date().toISOString();
      const takeover = await db.from('users').update({ created_at: now }).eq('id', row.id).is('circle_wallet_id', null).eq('created_at', row.created_at).select('id,email,created_at,circle_wallet_id,wallet_address').maybeSingle();
      if (takeover.error) throw new Error('Could not take over stale wallet reservation');
      reservation = takeover.data;
    }
  }
  if (reservation) {
    const id = reservation.id;
    const releaseReservation = () => db.from('users').delete().eq('id', id).is('circle_wallet_id', null);
    let wallet: Awaited<ReturnType<typeof createWallet>>;
    try { wallet = await createWallet(email); }
    catch (error) { await releaseReservation(); throw error; }
    try { await prefund(wallet.address); }
    catch (error) {
      if (error instanceof PrefundRefusedError) await releaseReservation();
      throw error;
    }
    const saved = await db.from('users').update({ circle_wallet_id: wallet.walletId, wallet_address: validAddress(wallet.address) }).eq('id', reservation.id).select('id,circle_wallet_id,wallet_address').maybeSingle();
    if (saved.error || !ready(saved.data)) throw new Error('Could not persist wallet mapping; operator recovery required');
    return saved.data;
  }
  const end = Date.now() + 10000;
  while (Date.now() < end) {
    const found = await db.from('users').select('id,circle_wallet_id,wallet_address').eq('email',email).maybeSingle();
    if (found.error) throw new Error('Could not read wallet mapping');
    if (ready(found.data)) return found.data;
    await new Promise(resolve => setTimeout(resolve,100));
  }
  throw new Error('Wallet provisioning pending; retry later or contact the organizer');
}
export async function claimUser(authUserId: string, input: string): Promise<void> {
  const email = normalizeEmail(input);
  const db = createAdminSupabase();
  const current = await db.from('users').select('id,auth_user_id').eq('email', email).maybeSingle();
  if (current.error || !current.data || (current.data.auth_user_id && current.data.auth_user_id !== authUserId)) throw new Error('Identity already linked to another account');
  const claimed = await db.from('users').update({ auth_user_id: authUserId, claimed: true }).eq('id',current.data.id).or(`auth_user_id.is.null,auth_user_id.eq.${authUserId}`).select('id').maybeSingle();
  if (claimed.error || !claimed.data) throw new Error('Could not claim wallet identity');
}
