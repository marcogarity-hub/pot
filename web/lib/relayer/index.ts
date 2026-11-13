import "server-only";
import { createPublicClient, createWalletClient, http, nonceManager, parseUnits, type Hex } from 'viem';
import { arcTestnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { potAddress, potInterface, validAddress } from '../circle/contract';
const MIN_MAX_FEE = BigInt(20000000000);
export class PrefundRefusedError extends Error {}
let budget = { day: '', spent: BigInt(0) };
// In-process budget; conservative reservation includes failures with uncertain delivery.
export function resetPrefundBudget() { budget = { day: '', spent: BigInt(0) }; }
function clients() {
  const chain = arcTestnet;
  const key = process.env.RELAYER_PRIVATE_KEY;
  if (!key) throw new PrefundRefusedError('RELAYER_PRIVATE_KEY unavailable');
  const account = privateKeyToAccount(key as Hex, { nonceManager });
  return { account, wallet: createWalletClient({ account, chain, transport: http() }), publicClient: createPublicClient({ chain, transport: http() }) };
}
export async function prefund(to: Hex, amount = BigInt(10) ** BigInt(18)): Promise<Hex> {
  try { validAddress(to); } catch { throw new PrefundRefusedError('Invalid or zero address'); }
  if (amount <= BigInt(0)) throw new PrefundRefusedError('Funding amount must be positive');
  const cap = parseUnits(process.env.PREFUND_DAILY_CAP ?? '50',18);
  const day = new Date().toISOString().slice(0,10);
  if (budget.day !== day) budget = { day, spent: BigInt(0) };
  if (budget.spent + amount > cap) throw new PrefundRefusedError('Daily prefund cap exceeded');
  const { wallet, publicClient } = clients();
  budget.spent += amount;
  return sendFunding(to, amount, { wallet, publicClient });
}
async function sendFunding(to: Hex, amount: bigint, {wallet, publicClient}: Pick<ReturnType<typeof clients>, 'wallet' | 'publicClient'>): Promise<Hex> {
  const { maxFeePerGas } = await publicClient.estimateFeesPerGas();
  const hash = await wallet.sendTransaction({ to, value: amount, maxFeePerGas: maxFeePerGas > MIN_MAX_FEE ? maxFeePerGas : MIN_MAX_FEE, maxPriorityFeePerGas: BigInt(1000000000) });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('Funding reverted');
  return hash;
}
/** Conductor-only demo principal, never expose through an HTTP route. */
export async function fundDemoPrincipal(to: Hex, amount: bigint): Promise<Hex> {
  validAddress(to);
  if (amount <= BigInt(0)) throw new Error('Funding amount must be positive');
  return sendFunding(to, amount, clients());
}
export async function relayerFinalize(potId: bigint): Promise<Hex> {
  if (potId < BigInt(0)) throw new Error('Invalid pot id');
  const { wallet, publicClient, account } = clients();
  if (await publicClient.getBalance({ address: account.address }) < parseUnits('5',18)) console.warn('Relayer balance below 5 USDC');
  const { maxFeePerGas } = await publicClient.estimateFeesPerGas();
  return wallet.writeContract({ address: potAddress(), abi: potInterface().abi, functionName: 'finalizeRelease', args: [potId], maxFeePerGas: maxFeePerGas > MIN_MAX_FEE ? maxFeePerGas : MIN_MAX_FEE, maxPriorityFeePerGas: BigInt(1000000000) });
}
