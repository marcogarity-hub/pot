import "server-only";
import { createPublicClient, formatUnits, http, isHex, parseUnits, type Hex } from 'viem';
import { arcTestnet } from 'viem/chains';
import { validAddress } from '../circle/contract';
import { circleClient } from '../circle/client';
import { callPot } from '../circle/tx';
import { createAdminSupabase } from '@/lib/supabase/admin';
export class PrefundRefusedError extends Error {}
export class PreSubmitError extends Error {
  constructor(readonly original: unknown) { super(original instanceof Error ? original.message : 'Prefund failed before submission'); }
}
function treasuryWalletId() {
  const id = process.env.CIRCLE_TREASURY_WALLET_ID;
  if (!id) throw new Error('CIRCLE_TREASURY_WALLET_ID unavailable');
  return id;
}
function publicClient() { return createPublicClient({ chain: arcTestnet, transport: http() }); }
function validateFunding(to: Hex, amount: bigint) {
  try { validAddress(to); } catch { throw new PrefundRefusedError('Invalid or zero address'); }
  if (amount <= BigInt(0)) throw new PrefundRefusedError('Funding amount must be positive');
}
export async function prefund(to: Hex, amount = BigInt(10) ** BigInt(18), idempotencyKey?: string): Promise<Hex> {
  validateFunding(to, amount);
  const p_amount = formatUnits(amount, 18);
  const p_cap = process.env.PREFUND_DAILY_CAP ?? '50';
  if (!/^\d+(?:\.\d+)?$/.test(p_cap) || !Number.isFinite(Number(p_cap)) || Number(p_cap) <= 0) throw new Error('Invalid PREFUND_DAILY_CAP');
  const db = createAdminSupabase();
  const reservation = await db.rpc('reserve_prefund', { p_amount, p_cap });
  if (reservation.error) throw new Error('Prefund ledger unavailable');
  if (reservation.data === false) throw new PrefundRefusedError('Daily prefund cap exceeded');
  if (reservation.data !== true) throw new Error('Prefund ledger unavailable');
  try { return await sendFunding(to, amount, idempotencyKey); }
  catch (error) {
    if (error instanceof PreSubmitError) {
      const released = await db.rpc('release_prefund', { p_amount });
      if (released.error) console.error('Could not release refused prefund reservation', released.error);
      throw error.original;
    }
    throw error;
  }
}
async function sendFunding(to: Hex, amount: bigint, suppliedIdempotencyKey?: string): Promise<Hex> {
  let client: ReturnType<typeof circleClient>;
  let walletId: string;
  let estimate: { gasLimit?: string; maxFee?: string; priorityFee?: string } | undefined;
  try {
    client = circleClient();
    walletId = treasuryWalletId();
    const request = { walletId, tokenAddress: '', destinationAddress: to, amount: [formatUnits(amount,18)] };
    estimate = (await client.estimateTransferFee({ ...request, blockchain: 'ARC-TESTNET' })).data?.medium;
    if (!estimate?.gasLimit || !estimate.maxFee || !estimate.priorityFee) throw new Error('Circle returned incomplete fee estimate');
  } catch (error) { throw new PreSubmitError(error); }
  // Native-token selector verified by the conductor's 2026-11-13 spike.
  const request = { walletId, tokenAddress: '', destinationAddress: to, amount: [formatUnits(amount,18)] };
  let maxFee: string;
  try { maxFee = parseUnits(estimate.maxFee,9) < BigInt(20000000000) ? '20' : estimate.maxFee; }
  catch (error) { throw new PreSubmitError(error); }
  const idempotencyKey = suppliedIdempotencyKey ?? crypto.randomUUID();
  // The 2026-11-13 live spike requires blockchain with walletId for native transfers;
  // the SDK passes it through to REST despite typing blockchain as never here.
  const submitted = await client.createTransaction({ ...request, blockchain: 'ARC-TESTNET', idempotencyKey, fee: { type: 'absolute', config: { gasLimit: estimate.gasLimit, maxFee, priorityFee: estimate.priorityFee } } } as unknown as Parameters<typeof client.createTransaction>[0]);
  const id = submitted.data?.id;
  if (!id) throw new Error('Circle returned no transaction id');
  const end = Date.now() + 120000;
  while (Date.now() < end) {
    const tx = (await client.getTransaction({ id })).data?.transaction;
    if (tx && ['FAILED','DENIED','CANCELLED','STUCK'].includes(tx.state)) throw new Error(`Treasury funding ${tx.state}: ${tx.errorReason ?? 'Unknown reason'}; ${tx.errorDetails ?? 'No details'}; reconcile transaction ${id} before retrying`);
    if (tx?.state === 'COMPLETE') {
      if (!tx.txHash || !isHex(tx.txHash)) throw new Error('Complete transaction has no hash');
      const receipt = await publicClient().waitForTransactionReceipt({ hash: tx.txHash });
      if (receipt.status !== 'success') throw new Error('Funding reverted');
      return tx.txHash;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Circle confirmation timed out; reconcile transaction ${id} (idempotencyKey ${idempotencyKey}) before retrying`);
}
/** Conductor-only demo principal, never expose through an HTTP route. */
export async function fundDemoPrincipal(to: Hex, amount: bigint): Promise<Hex> {
  validateFunding(to, amount);
  return sendFunding(to, amount);
}
export async function relayerBalance(): Promise<bigint> {
  const address = validAddress(process.env.TREASURY_ADDRESS ?? '');
  const balance = await publicClient().getBalance({ address });
  if (balance < parseUnits('5',18)) console.warn('Relayer balance below 5 USDC');
  return balance;
}
export async function relayerFinalize(potId: bigint): Promise<Hex> {
  if (potId < BigInt(0)) throw new Error('Invalid pot id');
  const walletId = treasuryWalletId();
  try { await relayerBalance(); } catch (error) { console.warn('Unable to read advisory relayer balance', error); }
  return (await callPot(walletId, 'finalizeRelease', [potId])).transactionHash;
}
