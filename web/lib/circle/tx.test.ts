import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { ContractFunctionExecutionError, ContractFunctionRevertedError, encodeErrorResult, encodeFunctionData, parseUnits } from 'viem';
import { potAbi, arcTestnet } from './__mocks__/pot';
const m = vi.hoisted(() => ({ createWallets: vi.fn(), getWallet: vi.fn(), simulateContract: vi.fn(), publicClient: vi.fn(), createContractExecutionTransaction: vi.fn(), getTransaction: vi.fn(), estimateContractExecutionFee: vi.fn(), receipt: vi.fn() }));
vi.mock('@circle-fin/developer-controlled-wallets', () => ({ initiateDeveloperControlledWalletsClient: () => m }));
vi.mock('viem', async (original) => ({ ...await original<typeof import('viem')>(), createPublicClient: (options: unknown) => { m.publicClient(options); return { simulateContract: m.simulateContract, waitForTransactionReceipt: m.receipt }; } }));
import { configurePotInterface } from './contract';
import { callPot } from './tx';
import { createWallet } from './wallets';
beforeEach(() => {
 vi.resetAllMocks(); configurePotInterface({ abi: potAbi, chain: arcTestnet });
 process.env.NEXT_PUBLIC_POT_ADDRESS = '0x1111111111111111111111111111111111111111';
 process.env.CIRCLE_API_KEY = 'test'; process.env.CIRCLE_ENTITY_SECRET = 'test'; process.env.CIRCLE_WALLET_SET_ID = 'set';
 m.getWallet.mockResolvedValue({ data: { wallet: { address: '0x2222222222222222222222222222222222222222' } } });
 m.simulateContract.mockResolvedValue({ result: undefined });
 m.estimateContractExecutionFee.mockResolvedValue({ data: { medium: { gasLimit: '100000', maxFee: '1', priorityFee: '1' } } });
 m.createContractExecutionTransaction.mockResolvedValue({ data: { id: 'tx' } });
 m.getTransaction.mockResolvedValue({ data: { transaction: { state: 'COMPLETE', txHash: '0x1234' } } });
 m.receipt.mockResolvedValue({ status: 'success', logs: [{ data: '0x', topics: [] }] });
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('sends the exact share and fee floor, returning receipt logs', async () => {
 const receipt = await callPot('wallet', 'pay', [BigInt(1)], parseUnits('300',18));
 expect(m.createContractExecutionTransaction).toHaveBeenCalledWith(expect.objectContaining({ walletId: 'wallet', amount: '300', fee: { type: 'absolute', config: { gasLimit: '100000', maxFee: '20', priorityFee: '1' } } }));
 expect(receipt.logs).toHaveLength(1);
});
it('decodes AlreadyPaid revert data', async () => {
 m.getTransaction.mockResolvedValue({ data: { transaction: { state: 'FAILED', errorDetails: encodeErrorResult({ abi: potAbi, errorName: 'AlreadyPaid' }) } } });
 await expect(callPot('wallet','pay',[BigInt(1)],BigInt(1))).rejects.toMatchObject({ code: 'AlreadyPaid' });
});
it('does not treat CONFIRMED as terminal and rejects DENIED', async () => {
 m.getTransaction.mockResolvedValueOnce({ data: { transaction: { state: 'CONFIRMED' } } }).mockResolvedValueOnce({ data: { transaction: { state: 'DENIED' } } });
 await expect(callPot('wallet','pay',[BigInt(1)])).rejects.toThrow(); expect(m.receipt).not.toHaveBeenCalled();
});
it('uses a stable UUID for normalized email', async () => {
 m.createWallets.mockResolvedValue({ data: { wallets: [{ id: 'wallet', address: '0x2222222222222222222222222222222222222222' }] } });
 await createWallet(' A@x.com'); await createWallet('a@x.com');
 expect(m.createWallets.mock.calls[0][0].idempotencyKey).toBe(m.createWallets.mock.calls[1][0].idempotencyKey);
 expect(m.createWallets.mock.calls[0][0].idempotencyKey).toMatch(/^[\da-f-]{14}4[\da-f-]{21}$/);
});

it('estimates using only the supported request fields', async () => {
 await callPot('wallet','pay',[BigInt(1)],parseUnits('300',18));
 expect(m.estimateContractExecutionFee).toHaveBeenCalledWith({
  callData: expect.stringMatching(/^0x/),
  contractAddress: process.env.NEXT_PUBLIC_POT_ADDRESS,
  amount: '300', source: { walletId: 'wallet' },
 });
});

it.each(['FAILED', 'DENIED', 'CANCELLED', 'STUCK'])('reports terminal contract state %s with Circle diagnostics', async state => {
 m.getTransaction.mockResolvedValue({ data: { transaction: { state, errorReason: 'ESTIMATION_ERROR', errorDetails: 'execution reverted' } } });
 await expect(callPot('wallet', 'pay', [BigInt(1)])).rejects.toMatchObject({ code: 'TransactionFailed', message: `Wallet transaction ${state}: ESTIMATION_ERROR; execution reverted; reconcile transaction tx` });
 expect(m.receipt).not.toHaveBeenCalled();
});
it('preserves the decoded revert code and Circle diagnostics', async () => {
 const errorDetails = encodeErrorResult({ abi: potAbi, errorName: 'AlreadyPaid' });
 m.getTransaction.mockResolvedValue({ data: { transaction: { state: 'FAILED', errorReason: 'ESTIMATION_ERROR', errorDetails } } });
 await expect(callPot('wallet', 'pay', [BigInt(1)])).rejects.toMatchObject({ code: 'AlreadyPaid', message: `Wallet transaction FAILED: ESTIMATION_ERROR; ${errorDetails}; reconcile transaction tx` });
});

it.each(['AlreadyPaid', 'DeadlinePassed'] as const)('rejects simulated %s before Circle estimation or submission', async code => {
 const revert = new ContractFunctionRevertedError({ abi: potAbi, data: encodeErrorResult({ abi: potAbi, errorName: code }), functionName: 'pay' });
 m.simulateContract.mockRejectedValueOnce(new ContractFunctionExecutionError(revert, { abi: potAbi, functionName: 'pay', args: [BigInt(1)] }));
 await expect(callPot('wallet', 'pay', [BigInt(1)], BigInt(1))).rejects.toMatchObject({ name: 'PotRevertError', code });
 expect(m.estimateContractExecutionFee).not.toHaveBeenCalled();
 expect(m.createContractExecutionTransaction).not.toHaveBeenCalled();
});
it('simulates from the Circle wallet on Arc with the submitted calldata and native value', async () => {
 const value = parseUnits('300', 18);
 await callPot('wallet', 'pay', [BigInt(1)], value);
 expect(m.getWallet).toHaveBeenCalledWith({ id: 'wallet' });
 expect(m.publicClient).toHaveBeenCalledWith({ chain: arcTestnet, transport: expect.any(Function) });
 expect(m.simulateContract).toHaveBeenCalledWith({ address: process.env.NEXT_PUBLIC_POT_ADDRESS, abi: potAbi, functionName: 'pay', args: [BigInt(1)], value, account: '0x2222222222222222222222222222222222222222' });
 expect(m.createContractExecutionTransaction).toHaveBeenCalledWith(expect.objectContaining({ callData: encodeFunctionData({ abi: potAbi, functionName: 'pay', args: [BigInt(1)] }), amount: '300' }));
 expect(m.simulateContract.mock.invocationCallOrder[0]).toBeLessThan(m.estimateContractExecutionFee.mock.invocationCallOrder[0]);
});
it.each(['RPC unavailable', 'wallet lookup unavailable', 'undecodable revert'])('warns and submits when preflight fails: %s', async reason => {
 const error = reason === 'undecodable revert' ? new ContractFunctionRevertedError({ abi: potAbi, data: '0xdeadbeef', functionName: 'pay' }) : new Error(reason);
 if (reason === 'wallet lookup unavailable') m.getWallet.mockRejectedValueOnce(error);
 else m.simulateContract.mockRejectedValueOnce(error);
 const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 await expect(callPot('wallet', 'pay', [BigInt(1)])).resolves.toMatchObject({ status: 'success' });
 expect(warn).toHaveBeenCalledWith('Pot pre-flight simulation unavailable; continuing through Circle', error);
 expect(m.createContractExecutionTransaction).toHaveBeenCalledTimes(1);
});
it('includes the Circle transaction id when the confirmed receipt reverted', async () => {
 m.receipt.mockResolvedValueOnce({ status: 'reverted' });
 await expect(callPot('wallet', 'pay', [BigInt(1)])).rejects.toMatchObject({ code: 'TransactionFailed', message: expect.stringContaining('reconcile transaction tx') });
});
