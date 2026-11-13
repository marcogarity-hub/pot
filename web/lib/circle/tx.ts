import { BaseError, ContractFunctionRevertedError, createPublicClient, decodeErrorResult, encodeFunctionData, formatUnits, http, isHex, parseUnits, type Hex, type TransactionReceipt } from 'viem';
import { circleClient } from './client';
import { potAddress, potInterface, validAddress } from './contract';
export type PotWriteFn = 'createPot' | 'pay' | 'swapSeat' | 'refund' | 'requestRelease' | 'object' | 'expire' | 'finalizeRelease';
export class PotRevertError extends Error {
  constructor(public code: string, message = code) { super(message); this.name = 'PotRevertError'; }
}
export class CircleTimeoutError extends Error {
  constructor(public circleTransactionId: string) {
    super(`Circle confirmation timed out; reconcile transaction ${circleTransactionId} before retrying`);
    this.name = 'CircleTimeoutError';
  }
}
function failure(id: string, state: string, reason?: string, details?: string): PotRevertError {
  const message = `Wallet transaction ${state}: ${reason ?? 'Unknown reason'}; ${details ?? 'No details'}; reconcile transaction ${id}`;
  const data = details?.match(/0x[\da-fA-F]{8,}/)?.[0];
  if (data && isHex(data)) {
    try { return new PotRevertError(decodeErrorResult({ abi: potInterface().abi, data }).errorName, message); } catch { /* Unknown provider error. */ }
  }
  return new PotRevertError('TransactionFailed', message);
}
export async function callPot(walletId: string, fn: PotWriteFn, args: readonly unknown[], value = BigInt(0)): Promise<TransactionReceipt> {
  if (value < BigInt(0)) throw new Error('Negative transaction value');
  const { abi, chain } = potInterface();
  const contractAddress = potAddress();
  const callData = encodeFunctionData({ abi, functionName: fn, args });
  const client = circleClient();
  const publicClient = createPublicClient({ chain, transport: http('https://rpc.testnet.arc.io') });
  try {
    const wallet = (await client.getWallet({ id: walletId })).data?.wallet;
    await publicClient.simulateContract({
      address: contractAddress, abi, functionName: fn, args, value,
      account: validAddress(wallet?.address ?? ''),
    });
  } catch (error) {
    const revert = error instanceof BaseError
      ? error.walk(cause => cause instanceof ContractFunctionRevertedError)
      : undefined;
    const code = revert instanceof ContractFunctionRevertedError ? revert.data?.errorName : undefined;
    // Only ABI-declared custom errors are authoritative pre-flight failures.
    if (code && abi.some(item => item.type === 'error' && item.name === code)) throw new PotRevertError(code);
    console.warn('Pot pre-flight simulation unavailable; continuing through Circle', error);
  }
  const request = { walletId, contractAddress, callData, amount: formatUnits(value,18) };
  const estimate = (await client.estimateContractExecutionFee({ callData, contractAddress, amount: request.amount, source: { walletId } })).data?.medium;
  if (!estimate?.gasLimit || !estimate.maxFee || !estimate.priorityFee) throw new Error('Circle returned incomplete fee estimate');
  const maxFee = parseUnits(estimate.maxFee,9) < BigInt(20000000000) ? '20' : estimate.maxFee;
  const submitted = await client.createContractExecutionTransaction({ ...request, fee: { type: 'absolute', config: { gasLimit: estimate.gasLimit, maxFee, priorityFee: estimate.priorityFee } } });
  const id = submitted.data?.id;
  if (!id) throw new Error('Circle returned no transaction id');
  const end = Date.now() + 120000;
  while (Date.now() < end) {
    const tx = (await client.getTransaction({ id })).data?.transaction;
    if (tx && ['FAILED','DENIED','CANCELLED','STUCK'].includes(tx.state)) throw failure(id, tx.state, tx.errorReason, tx.errorDetails);
    if (tx?.state === 'COMPLETE') {
      if (!tx.txHash || !isHex(tx.txHash)) throw new Error('Complete transaction has no hash');
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx.txHash as Hex });
      if (receipt.status !== 'success') throw new PotRevertError('TransactionFailed', `Wallet transaction receipt reverted; reconcile transaction ${id}`);
      return receipt;
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new CircleTimeoutError(id);
}
