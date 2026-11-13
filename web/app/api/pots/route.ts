import { randomBytes } from 'node:crypto';
import { parseEventLogs, parseUnits, type Hex } from 'viem';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { claimUser, ensureUser } from '@/lib/circle/identity';
import { callPot, PotRevertError } from '@/lib/circle/tx';
import { potAddress, potInterface, validAddress } from '@/lib/circle/contract';
import { createPotSchema } from './schema';
import { createPotLimiter } from './limiter';
import { toHttp } from './errors';
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const session = await supabase.auth.getUser();
  if (session.error || !session.data.user?.email) return Response.json({error:'Unauthorized'},{status:401});
  let raw: unknown;
  try { raw = await request.json(); } catch { return Response.json({message:'Invalid JSON body'},{status:400}); }
  const validated = createPotSchema.safeParse(raw);
  if (!validated.success) return Response.json({message:validated.error.issues[0].message},{status:400});
  const body = validated.data;
  try { potAddress(); } catch (error) { return toHttp(error); }
  if (!createPotLimiter.take(session.data.user.id)) return Response.json({message:'You can create at most 5 pots per hour. Please try again later.'},{status:429,headers:{'Retry-After':'3600'}});
  let addresses: Hex[];
  let organizer: Awaited<ReturnType<typeof ensureUser>>;
  try {
    organizer = await ensureUser(session.data.user.email.trim().toLowerCase());
    await claimUser(session.data.user.id, session.data.user.email.trim().toLowerCase());
    const members = await Promise.all(body.memberEmails.map(email=>ensureUser(email)));
    // Provisioning is separate from validation: never submit zero or duplicate wallets.
    try {
      validAddress(organizer.wallet_address);
      addresses = members.map(user=>validAddress(user.wallet_address));
      if (new Set(addresses).size !== addresses.length) throw new Error('Duplicate member wallets');
    } catch { return Response.json({message:'Invalid or duplicate wallet address'},{status:400}); }
  } catch { return Response.json({message:'Wallet provisioning pending. Please retry shortly.'},{status:503}); }
  let potId: string;
  let transactionHash: Hex | undefined;
  try {
    const total = parseUnits(body.total,18);
    const receipt = await callPot(organizer.circle_wallet_id,'createPot',[
      total,total / BigInt(addresses.length),addresses,BigInt(Math.floor(Date.parse(body.deadline)/1000)),BigInt(body.threshold),BigInt(body.objectionWindowSeconds),BigInt(body.requestWindowSeconds),
    ]);
    transactionHash = receipt.transactionHash;
    const logs = parseEventLogs({abi:potInterface().abi,eventName:'PotCreated',logs:receipt.logs.filter(log=>log.address.toLowerCase()===potAddress()),strict:true});
    const args = logs[0]?.args as {potId?: bigint; organizer?: string} | undefined;
    if (typeof args?.potId !== 'bigint' || args.organizer?.toLowerCase() !== organizer.wallet_address.toLowerCase()) throw new Error('Missing PotCreated event');
    potId = args.potId.toString();
  } catch (error) {
    if (error instanceof Error && error.name === 'CircleTimeoutError') return toHttp(error);
    if (error instanceof PotRevertError) return toHttp(error);
    return Response.json({message:'Pot creation could not be confirmed. Reconcile the transaction before retrying.',...(transactionHash?{transactionHash}:{})},{status:502}); }
  const inviteToken = randomBytes(32).toString('base64url');
  try {
    const admin = createAdminSupabase();
    const meta = await admin.from('pot_meta').insert({pot_id:potId,title:body.title,invite_token:inviteToken});
    if (meta.error) throw new Error('Metadata insert failed');
    const invites = await admin.from('pot_invites').insert(body.memberEmails.map((email,index)=>({pot_id:potId,email,address:addresses[index]})));
    if (invites.error) throw new Error('Invite insert failed');
    return Response.json({potId,inviteToken},{status:201});
  } catch { return Response.json({message:'Pot created, but metadata needs recovery. Do not create it again.',potId,transactionHash},{status:503}); }
}
