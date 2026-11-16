import { randomBytes } from 'node:crypto';
import { isHex, parseEventLogs, type Hex } from 'viem';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { getWalletUser } from '@/lib/circle/identity';
import { getCircleTransaction } from '@/lib/circle/transactions';
import { getPotReceipt } from '@/lib/circle/receipt';
import { readPot } from '@/lib/circle/read';
import { potAddress, potInterface, validAddress } from '@/lib/circle/contract';
import { reconcilePotSchema } from '../schema';
import { validationMessage } from '../errors';

const pending = () => Response.json({ error: 'StillPending', message: 'Still confirming. Checking again shortly.' }, { status: 202 });
const failed = () => Response.json({ error: 'CreateFailed', message: 'The pot was not created. It is safe to try again.' }, { status: 409 });

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await getVerifiedUser(supabase);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({ message: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = reconcilePotSchema.safeParse(raw);
  if (!parsed.success) return Response.json({ message: validationMessage(parsed.error.issues[0]) }, { status: 400 });
  const body = parsed.data;

  let caller;
  try { caller = await getWalletUser(user.email); }
  catch { return Response.json({ message: 'Could not read wallet mapping' }, { status: 503 }); }
  if (!caller) return Response.json({ error: 'NoWallet' }, { status: 403 });

  let hash: Hex;
  if (body.circleTransactionId) {
    let tx;
    try { tx = await getCircleTransaction(body.circleTransactionId); }
    catch { return Response.json({ message: 'Could not check transaction yet. Try again.' }, { status: 503 }); }
    if (!tx) return Response.json({ message: 'Could not find transaction' }, { status: 404 });
    if (tx.walletId !== caller.circle_wallet_id) return Response.json({ error: 'Forbidden' }, { status: 403 });
    if (tx.state === 'FAILED' || tx.state === 'CANCELLED' || tx.state === 'DENIED' || tx.state === 'STUCK') return failed();
    if (tx.state !== 'COMPLETE') return pending();
    if (!tx.txHash || !isHex(tx.txHash, { strict: true }) || tx.txHash.length !== 66) return pending();
    hash = tx.txHash as Hex;
  } else hash = body.transactionHash! as Hex;

  let receipt;
  try { receipt = await getPotReceipt(hash); }
  catch { return Response.json({ message: 'Could not check transaction receipt yet. Try again.' }, { status: 503 }); }
  if (!receipt) return pending();
  if (receipt.status !== 'success') return failed();

  let potId: string;
  try {
    const address = potAddress();
    const logs = parseEventLogs({ abi: potInterface().abi, eventName: 'PotCreated', logs: receipt.logs.filter(log => log.address.toLowerCase() === address), strict: true });
    const event = logs[0]?.args as { potId?: bigint; organizer?: string } | undefined;
    if (typeof event?.potId !== 'bigint') return failed();
    if (event.organizer?.toLowerCase() !== caller.wallet_address.toLowerCase()) return Response.json({ error: 'Forbidden' }, { status: 403 });
    potId = event.potId.toString();
  } catch { return failed(); }

  let memberUsers;
  try { memberUsers = await Promise.all(body.memberEmails.map(email => getWalletUser(email))); }
  catch { return Response.json({ message: 'Could not verify the pot yet. Try again.' }, { status: 503 }); }
  if (memberUsers.some(user => !user)) return Response.json({ error: 'MembersMismatch' }, { status: 422 });

  let expected: string[];
  try { expected = memberUsers.map(user => validAddress(user!.wallet_address).toLowerCase()); }
  catch { return Response.json({ error: 'MembersMismatch' }, { status: 422 }); }
  if (new Set(expected).size !== expected.length) return Response.json({ error: 'MembersMismatch' }, { status: 422 });

  let pot;
  try { pot = await readPot(BigInt(potId)); }
  catch { return Response.json({ message: 'Could not verify the pot yet. Try again.' }, { status: 503 }); }
  if (pot.organizer.toLowerCase() !== caller.wallet_address.toLowerCase()) return Response.json({ error: 'Forbidden' }, { status: 403 });
  let onchain: string[];
  try { onchain = (pot.members ?? []).map(member => validAddress(member).toLowerCase()); }
  catch { return Response.json({ error: 'MembersMismatch' }, { status: 422 }); }
  if (onchain.length !== expected.length || onchain.some(address => !expected.includes(address))) return Response.json({ error: 'MembersMismatch' }, { status: 422 });

  const admin = createAdminSupabase();
  try {
    const existing = await admin.from('pot_meta').select('invite_token').eq('pot_id', potId).maybeSingle();
    if (existing.error) throw new Error('Metadata lookup failed');
    if (existing.data) {
      // Backfill invites a previous attempt may have missed; existing rows are left untouched.
      const backfill = await admin.from('pot_invites').upsert(
        body.memberEmails.map((email, index) => ({ pot_id: potId, email, address: expected[index] })),
        { onConflict: 'pot_id,address', ignoreDuplicates: true },
      );
      if (backfill.error) throw new Error('Invite backfill failed');
      return Response.json({ potId, inviteToken: existing.data.invite_token }, { status: 200 });
    }
    const inviteToken = randomBytes(32).toString('base64url');
    const meta = await admin.from('pot_meta').insert({ pot_id: potId, title: body.title, invite_token: inviteToken });
    if (meta.error) {
      if (meta.error.code === '23505') {
        const raced = await admin.from('pot_meta').select('invite_token').eq('pot_id', potId).maybeSingle();
        if (!raced.error && raced.data) return Response.json({ potId, inviteToken: raced.data.invite_token }, { status: 200 });
      }
      throw new Error('Metadata insert failed');
    }
    const invites = await admin.from('pot_invites').insert(body.memberEmails.map((email, index) => ({ pot_id: potId, email, address: expected[index] })));
    if (invites.error) throw new Error('Invite insert failed');
    return Response.json({ potId, inviteToken }, { status: 201 });
  } catch { return Response.json({ message: 'Could not save the pot yet. Try again.' }, { status: 503 }); }
}
