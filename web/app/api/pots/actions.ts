import { keccak256, toBytes } from 'viem';
import { z } from 'zod';
import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { ensureUser } from '@/lib/circle/identity';
import { callPot, PotRevertError } from '@/lib/circle/tx';
import { potAddress, validAddress } from '@/lib/circle/contract';
import { readPot, chainTimestamp } from '@/lib/circle/read';
import { relayerFinalize } from '@/lib/relayer';
import { toHttp } from './errors';

const uint256Max = BigInt(2) ** BigInt(256) - BigInt(1);
const email = z.string().trim().toLowerCase().email();
const swapSchema = z.object({ leaverEmail: email, replacementEmail: email });
const releaseSchema = z.object({ receiptText: z.string().min(1).max(500) });
type Action = 'pay' | 'refund' | 'object' | 'expire' | 'request-release' | 'swap' | 'finalize';
type Context = { params: Promise<{ potId: string }> };
const finalizeFlights = new Map<string, Promise<Response>>();

function recovery(potId: string, transactionHash: string) {
  return Response.json({
    message: 'Transaction confirmed, but metadata needs recovery. Do not submit it again.',
    potId, transactionHash,
  }, { status: 503 });
}

export function actionHandler(action: Action) {
  return async (request: Request, context: Context): Promise<Response> => {
    try {
      const { potId: rawId } = await context.params;
      if (!/^\d{1,78}$/.test(rawId) || BigInt(rawId) > uint256Max) {
        return Response.json({ error: 'InvalidPotId' }, { status: 400 });
      }
      potAddress();
      const potId = BigInt(rawId);
      const id = potId.toString();
      if (action === 'finalize') {
        let flight = finalizeFlights.get(id);
        if (!flight) {
          flight = (async () => {
            const pot = await readPot(potId);
            if (pot.state === 3) return Response.json({ alreadyFinalized: true });
            if (pot.state !== 2 || pot.objectionsCount >= pot.threshold || await chainTimestamp() < pot.releaseEligibleAt) {
              return Response.json({ error: 'NotEligible' }, { status: 409 });
            }
            try {
              return Response.json({ transactionHash: await relayerFinalize(potId) });
            } catch (error) {
              try { if ((await readPot(potId)).state === 3) return Response.json({ alreadyFinalized: true }); }
              catch { /* Preserve the original relayer error if the re-read fails. */ }
              throw error;
            }
          })();
          finalizeFlights.set(id, flight);
          void flight.finally(() => { if (finalizeFlights.get(id) === flight) finalizeFlights.delete(id); }).catch(() => {});
        }
        return await flight;
      }

      const supabase = await createServerSupabase();
      const session = await supabase.auth.getUser();
      if (session.error || !session.data.user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const caller = await ensureUser(session.data.user.email.trim().toLowerCase());
      let callerAddress: string;
      try { callerAddress = validAddress(caller.wallet_address); }
      catch { return Response.json({ error: 'InvalidWalletAddress' }, { status: 400 }); }

      const pot = await readPot(potId);
      if (action === 'pay') {
        const receipt = await callPot(caller.circle_wallet_id, 'pay', [potId], pot.share);
        return Response.json({ transactionHash: receipt.transactionHash });
      }
      if (action === 'refund' || action === 'object' || action === 'expire') {
        const receipt = await callPot(caller.circle_wallet_id, action, [potId]);
        return Response.json({ transactionHash: receipt.transactionHash });
      }

      if (pot.organizer.toLowerCase() !== callerAddress) return Response.json({ error: 'Forbidden' }, { status: 403 });
      let body: unknown;
      try { body = await request.json(); }
      catch { return Response.json({ error: 'InvalidBody' }, { status: 400 }); }

      if (action === 'request-release') {
        const parsed = releaseSchema.safeParse(body);
        if (!parsed.success) return Response.json({ error: 'InvalidReceiptText' }, { status: 400 });
        if (pot.state !== 1) return toHttp(new PotRevertError('WrongState'));
        const { receiptText } = parsed.data;
        const receipt = await callPot(caller.circle_wallet_id, 'requestRelease', [potId, keccak256(toBytes(receiptText))]);
        try {
          const saved = await createAdminSupabase().from('pot_meta').update({ receipt_text: receiptText }).eq('pot_id', id).select('pot_id').single();
          if (saved.error || !saved.data) throw new Error('Receipt metadata missing');
        } catch { return recovery(id, receipt.transactionHash); }
        return Response.json({ transactionHash: receipt.transactionHash });
      }

      const parsed = swapSchema.safeParse(body);
      if (!parsed.success) return Response.json({ error: 'InvalidEmails' }, { status: 400 });
      const { leaverEmail, replacementEmail } = parsed.data;
      const admin = createAdminSupabase();
      // Lookup only: a misspelled leaver must never provision a new wallet.
      const leaver = await admin.from('users').select('wallet_address').eq('email', leaverEmail).maybeSingle();
      if (leaver.error) throw new Error('Leaver lookup failed');
      if (!leaver.data?.wallet_address) return Response.json({ error: 'UnknownLeaver' }, { status: 400 });
      const replacement = await ensureUser(replacementEmail);
      let leaverAddress: string;
      let replacementAddress: string;
      try {
        leaverAddress = validAddress(leaver.data.wallet_address);
        replacementAddress = validAddress(replacement.wallet_address);
      } catch { return Response.json({ error: 'InvalidWalletAddress' }, { status: 400 }); }
      const receipt = await callPot(caller.circle_wallet_id, 'swapSeat', [potId, leaverAddress, replacementAddress]);
      try {
        const saved = await admin.from('pot_invites').upsert({ pot_id: id, address: replacementAddress, email: replacementEmail }, { onConflict: 'pot_id,address' });
        if (saved.error) throw new Error('Invite save failed');
      } catch { return recovery(id, receipt.transactionHash); }
      return Response.json({ transactionHash: receipt.transactionHash });
    } catch (error) { return toHttp(error); }
  };
}
