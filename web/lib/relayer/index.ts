import "server-only";
import { createPublicClient, formatUnits, http, isHex, parseUnits, type Hex } from 'viem';
import { arcTestnet } from 'viem/chains';
import { validAddress } from '../circle/contract';
import { circleClient } from '../circle/client';
import { callPot } from '../circle/tx';
export class PrefundRefusedError extends Error {}
let budget = { day: '', spent: BigInt(0) };
// In-process budget; conservative reservation includes failures with uncertain delivery.
export function resetPrefundBudget() { budget = { day: '', spent: BigInt(0) }; }
function treasuryWalletId() {
  const id = process.env.CIRCLE_TREASURY_WALLET_ID;
  if (!id) throw new PrefundRefusedError('CIRCLE_TREASURY_WALLET_ID unavailable');
  return id;
}
function publicClient() { return createPublicClient({ chain: arcTestnet, transport: http() }); }
function validateFunding(to: Hex, amount: bigint) {
  try { validAddress(to); } catch { throw new PrefundRefusedError('Invalid or zero address'); }
  if (amount <= BigInt(0)) throw new PrefundRefusedError('Funding amount must be positive');
}
export async function prefund(to: Hex, amount = BigInt(10) ** BigInt(18)): Promise<Hex> {
  validateFunding(to, amount);
  const walletId = treasuryWalletId();
  const cap = parseUnits(process.env.PREFUND_DAILY_CAP ?? '50',18);
  const day = new Date().toISOString().slice(0,10);
  if (budget.day !== day) budget = { day, spent: BigInt(0) };
  if (budget.spent + amount > cap) throw new PrefundRefusedError('Daily prefund cap exceeded');
  budget.spent += amount;
  return sendFunding(to, amount, walletId);
}
async function sendFunding(to: Hex, amount: bigint, walletId: string): Promise<Hex> {
  const client = circleClient();
  // Native-token selector verified by the conductor's 2026-11-13 spike.
  const request = { walletId, tokenAddress: '', destinationAddress: to, amount: [formatUnits(amount,18)] };
  const estimate = (await client.estimateTransferFee({ ...request, blockchain: 'ARC-TESTNET' })).data?.medium;
  if (!estimate?.gasLimit || !estimate.maxFee || !estimate.priorityFee) throw new Error('Circle returned incomplete fee estimate');
  const maxFee = parseUnits(estimate.maxFee,9) < BigInt(20000000000) ? '20' : estimate.maxFee;
  const idempotencyKey = crypto.randomUUID();
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
  return sendFunding(to, amount, treasuryWalletId());
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
