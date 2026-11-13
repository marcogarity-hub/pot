vi.mock('@/lib/pot', async original => ({ ...await original<typeof import('@/lib/pot')>(), get POT_ADDRESS() { return process.env.NEXT_PUBLIC_POT_ADDRESS; } }));
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ getWallet: vi.fn(), simulateContract: vi.fn(), createTransaction: vi.fn(), estimateTransferFee: vi.fn(), createContractExecutionTransaction: vi.fn(), estimateContractExecutionFee: vi.fn(), getTransaction: vi.fn(), getBalance: vi.fn(), receipt: vi.fn(), rpc: vi.fn() }));
vi.mock('../circle/client', () => ({ circleClient: () => m }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: () => ({ rpc: m.rpc }) }));
vi.mock('viem', async (original) => ({ ...await original<typeof import('viem')>(), createPublicClient: () => ({ simulateContract: m.simulateContract, getBalance: m.getBalance, waitForTransactionReceipt: m.receipt }) }));
import { prefund, relayerFinalize, relayerBalance, PrefundRefusedError } from './index';
import { potAbi } from '@/lib/pot';
import { encodeFunctionData } from 'viem';
const to = '0x1111111111111111111111111111111111111111';
const treasury = '0x2222222222222222222222222222222222222222';
const unit = BigInt(10) ** BigInt(18);
let reserved = 0;
beforeEach(() => {
 vi.resetAllMocks();
 reserved = 0;
 m.rpc.mockImplementation(async (fn: string, args: { p_amount: string; p_cap?: string }) => {
  if (fn === 'reserve_prefund') { const amount = Number(args.p_amount); if (reserved + amount > Number(args.p_cap)) return { data: false, error: null }; reserved += amount; return { data: true, error: null }; }
  reserved = Math.max(0, reserved - Number(args.p_amount)); return { data: null, error: null };
 });
 vi.stubEnv('CIRCLE_TREASURY_WALLET_ID', 'treasury-wallet'); vi.stubEnv('TREASURY_ADDRESS', treasury);
 vi.stubEnv('PREFUND_DAILY_CAP', '2'); vi.stubEnv('NEXT_PUBLIC_POT_ADDRESS', to);
 const estimate = { data: { medium: { gasLimit: '21000', maxFee: '10', priorityFee: '1' } } };
 m.estimateTransferFee.mockResolvedValue(estimate); m.estimateContractExecutionFee.mockResolvedValue(estimate);
 m.createTransaction.mockResolvedValue({ data: { id: 'funding' } });
 m.createContractExecutionTransaction.mockResolvedValue({ data: { id: 'finalize' } });
 m.getTransaction.mockResolvedValue({ data: { transaction: { state: 'COMPLETE', txHash: '0x1234' } } });
 m.receipt.mockResolvedValue({ status: 'success', transactionHash: '0x1234' });
 m.getWallet.mockResolvedValue({ data: { wallet: { address: treasury } } });
 m.simulateContract.mockResolvedValue({ result: undefined });
 m.getBalance.mockResolvedValue(unit * BigInt(10));
});
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); vi.restoreAllMocks(); });
it('prefunds one native USDC through Circle and confirms the receipt', async () => {
 await expect(prefund(to)).resolves.toBe('0x1234');
 expect(m.estimateTransferFee).toHaveBeenCalledWith({ walletId: 'treasury-wallet', tokenAddress: '', blockchain: 'ARC-TESTNET', destinationAddress: to, amount: ['1'] });
 expect(m.createTransaction).toHaveBeenCalledWith({ walletId: 'treasury-wallet', tokenAddress: '', blockchain: 'ARC-TESTNET', idempotencyKey: expect.any(String), destinationAddress: to, amount: ['1'], fee: { type: 'absolute', config: { gasLimit: '21000', maxFee: '20', priorityFee: '1' } } });
 expect(m.receipt).toHaveBeenCalledWith({ hash: '0x1234' });
 expect(m.rpc).toHaveBeenCalledWith('reserve_prefund', { p_amount: '1', p_cap: '2' });
});
it('submits two concurrent prefunds through Circle without nonce errors', async () => {
 await expect(Promise.all([prefund(to), prefund(to)])).resolves.toEqual(['0x1234', '0x1234']);
 expect(m.createTransaction).toHaveBeenCalledTimes(2);
 const keys = m.createTransaction.mock.calls.map(([request]) => request.idempotencyKey);
 expect(keys.every(key => /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(key))).toBe(true);
 expect(new Set(keys).size).toBe(2);
});
it('reserves the cap before concurrent submissions', async () => {
 const results = await Promise.allSettled([prefund(to), prefund(to), prefund(to)]);
 expect(results.filter(x => x.status === 'rejected')).toHaveLength(1);
 expect(m.createTransaction).toHaveBeenCalledTimes(2);
});
it('uses the shared atomic cap and refuses when Postgres reports over cap', async () => {
 m.rpc.mockImplementationOnce(async () => ({ data: false, error: null }));
 await expect(prefund(to)).rejects.toBeInstanceOf(PrefundRefusedError);
 expect(m.createTransaction).not.toHaveBeenCalled();
});
it.each(['fee estimate error','incomplete estimate','missing treasury id'])('releases reservation on pre-submit %s', async reason => {
 if(reason==='fee estimate error') m.estimateTransferFee.mockRejectedValueOnce(new Error('rpc down'));
 if(reason==='incomplete estimate') m.estimateTransferFee.mockResolvedValueOnce({data:{medium:{maxFee:'10'}}});
 if(reason==='missing treasury id') vi.stubEnv('CIRCLE_TREASURY_WALLET_ID','');
 await expect(prefund(to)).rejects.toThrow();
 expect(m.rpc).toHaveBeenNthCalledWith(2, 'release_prefund', { p_amount: '1' });
 expect(m.createTransaction).not.toHaveBeenCalled();
});
it('distinguishes ledger unavailable from a real cap refusal',async()=>{
 m.rpc.mockResolvedValueOnce({data:null,error:{message:'offline'}});
 await expect(prefund(to)).rejects.toThrow('Prefund ledger unavailable');
 m.rpc.mockResolvedValueOnce({data:false,error:null});await expect(prefund(to)).rejects.toBeInstanceOf(PrefundRefusedError);
});
it('rejects invalid daily cap configuration before ledger reservation',async()=>{
 vi.stubEnv('PREFUND_DAILY_CAP','1e2'); await expect(prefund(to)).rejects.toThrow('Invalid PREFUND_DAILY_CAP');expect(m.rpc).not.toHaveBeenCalled();
});
it('uses a supplied idempotency key for retries',async()=>{
 await prefund(to,unit,'12345678-1234-5234-8234-123456789abc');expect(m.createTransaction).toHaveBeenCalledWith(expect.objectContaining({idempotencyKey:'12345678-1234-5234-8234-123456789abc'}));
});
it.each(['zero address', 'invalid address', 'zero amount', 'negative amount', 'cap', 'missing wallet'])('classifies %s as a pre-send refusal', async reason => {
 if (reason === 'cap') vi.stubEnv('PREFUND_DAILY_CAP', '0');
 if (reason === 'missing wallet') vi.stubEnv('CIRCLE_TREASURY_WALLET_ID', '');
 const address = reason === 'zero address' ? `0x${'0'.repeat(40)}` as const : reason === 'invalid address' ? '0xbad' : to;
 const amount = reason === 'zero amount' ? BigInt(0) : reason === 'negative amount' ? -unit : undefined;
 if(reason==='cap'||reason==='missing wallet') await expect(prefund(address,amount)).rejects.toThrow();
 else await expect(prefund(address, amount)).rejects.toBeInstanceOf(PrefundRefusedError);
 expect(m.createTransaction).not.toHaveBeenCalled(); expect(m.estimateTransferFee).not.toHaveBeenCalled();
});
it('retains the reserved cap after an ambiguous submission failure', async () => {
 const failure = new Error('connection lost after submission'); m.createTransaction.mockRejectedValueOnce(failure);
 await expect(prefund(to)).rejects.toBe(failure); await prefund(to);
 await expect(prefund(to)).rejects.toBeInstanceOf(PrefundRefusedError);
});
it('keeps demo principal separate from the daily gas allowance', async () => {
 const { topup } = await import('./topup'); await topup(to, '300'); await prefund(to, unit * BigInt(2));
 expect(m.createTransaction).toHaveBeenNthCalledWith(1, expect.objectContaining({ walletId: 'treasury-wallet', tokenAddress: '', amount: ['300'] }));
});
it('finalizes through callPot with the treasury wallet and fee floor', async () => {
 await expect(relayerFinalize(BigInt(1))).resolves.toBe('0x1234');
 expect(m.createContractExecutionTransaction).toHaveBeenCalledWith(expect.objectContaining({ walletId: 'treasury-wallet', callData: encodeFunctionData({ abi: potAbi, functionName: 'finalizeRelease', args: [BigInt(1)] }), fee: { type: 'absolute', config: { gasLimit: '21000', maxFee: '20', priorityFee: '1' } } }));
});
it('preserves Circle fee estimates above the floor for transfer and finalize', async () => {
 const estimate = { data: { medium: { gasLimit: '21000', maxFee: '45', priorityFee: '2' } } };
 m.estimateTransferFee.mockResolvedValue(estimate); m.estimateContractExecutionFee.mockResolvedValue(estimate);
 await prefund(to); await relayerFinalize(BigInt(1));
 for (const submit of [m.createTransaction, m.createContractExecutionTransaction]) expect(submit).toHaveBeenCalledWith(expect.objectContaining({ fee: { type: 'absolute', config: { gasLimit: '21000', maxFee: '45', priorityFee: '2' } } }));
});
it('reads the treasury native balance without Circle credentials and warns below five USDC', async () => {
 vi.stubEnv('CIRCLE_TREASURY_WALLET_ID', ''); m.getBalance.mockResolvedValue(unit);
 const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 await expect(relayerBalance()).resolves.toBe(unit);
 expect(m.getBalance).toHaveBeenCalledWith({ address: treasury }); expect(warn).toHaveBeenCalledWith('Relayer balance below 5 USDC');
 expect(m.createTransaction).not.toHaveBeenCalled();
});
it('does not warn at five USDC', async () => {
 m.getBalance.mockResolvedValue(unit * BigInt(5)); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 await relayerBalance(); expect(warn).not.toHaveBeenCalled();
});
it('warns on low balance when finalizing', async () => {
 m.getBalance.mockResolvedValue(unit); const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 await relayerFinalize(BigInt(1)); expect(warn).toHaveBeenCalled();
});
it.each(['FAILED', 'DENIED', 'CANCELLED', 'STUCK'])('rejects terminal transfer state %s', async state => {
 vi.useFakeTimers();
 m.getTransaction.mockResolvedValue({ data: { transaction: { state, errorReason: 'ESTIMATION_ERROR', errorDetails: 'execution reverted' } } });
 const assertion = expect(prefund(to)).rejects.toThrow(`Treasury funding ${state}: ESTIMATION_ERROR; execution reverted; reconcile transaction funding`);
 await vi.advanceTimersByTimeAsync(120000); await assertion;
 expect(m.receipt).not.toHaveBeenCalled();
});
it('waits past CONFIRMED until COMPLETE', async () => {
 vi.useFakeTimers(); m.getTransaction.mockResolvedValueOnce({ data: { transaction: { state: 'CONFIRMED', txHash: '0x1234' } } });
 const pending = prefund(to); await vi.advanceTimersByTimeAsync(500); await pending;
 expect(m.getTransaction).toHaveBeenCalledTimes(2); expect(m.receipt).toHaveBeenCalledTimes(1);
});
it('times out with the reconciliation transaction id and submitted idempotency key', async () => {
 vi.useFakeTimers(); m.getTransaction.mockResolvedValue({ data: { transaction: { state: 'SENT' } } });
 const key = '12345678-1234-4234-8234-123456789abc';
 vi.spyOn(crypto, 'randomUUID').mockReturnValue(key);
 const assertion = expect(prefund(to)).rejects.toThrow(`reconcile transaction funding (idempotencyKey ${key})`);
 await vi.advanceTimersByTimeAsync(120000); await assertion;
 expect(m.createTransaction).toHaveBeenCalledWith(expect.objectContaining({ idempotencyKey: key }));
});
it.each(['missing id', 'missing hash', 'failed receipt', 'incomplete fee'])('rejects %s', async reason => {
 if (reason === 'missing id') m.createTransaction.mockResolvedValue({ data: {} });
 if (reason === 'missing hash') m.getTransaction.mockResolvedValue({ data: { transaction: { state: 'COMPLETE' } } });
 if (reason === 'failed receipt') m.receipt.mockResolvedValue({ status: 'reverted' });
 if (reason === 'incomplete fee') m.estimateTransferFee.mockResolvedValue({ data: { medium: { maxFee: '10' } } });
 await expect(prefund(to)).rejects.toThrow();
});
it('refuses finalize without a wallet or with a negative pot id before submission', async () => {
 await expect(relayerFinalize(-BigInt(1))).rejects.toThrow('Invalid pot id');
 vi.stubEnv('CIRCLE_TREASURY_WALLET_ID', ''); await expect(relayerFinalize(BigInt(1))).rejects.toThrow();
 expect(m.createContractExecutionTransaction).not.toHaveBeenCalled();
});
it('defaults to a fifty USDC daily cap', async () => {
 vi.stubEnv('PREFUND_DAILY_CAP', undefined);
 await prefund(to, unit * BigInt(50));
 await expect(prefund(to)).rejects.toBeInstanceOf(PrefundRefusedError);
 expect(m.createTransaction).toHaveBeenCalledTimes(1);
});
it('does not consume the cap when the treasury wallet is missing', async () => {
 vi.stubEnv('CIRCLE_TREASURY_WALLET_ID', ''); await expect(prefund(to)).rejects.toThrow('CIRCLE_TREASURY_WALLET_ID unavailable');
 expect(m.rpc).toHaveBeenNthCalledWith(2, 'release_prefund', { p_amount: '1' });
 vi.stubEnv('CIRCLE_TREASURY_WALLET_ID', 'treasury-wallet'); await prefund(to, unit * BigInt(2));
 expect(m.createTransaction).toHaveBeenCalledTimes(1);
});

it.each(['unset address', 'RPC failure'])('finalizes despite an advisory balance failure: %s', async reason => {
 if (reason === 'unset address') vi.stubEnv('TREASURY_ADDRESS', undefined);
 else m.getBalance.mockRejectedValue(new Error('RPC unavailable'));
 const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
 await expect(relayerFinalize(BigInt(1))).resolves.toBe('0x1234');
 expect(warn).toHaveBeenCalledWith('Unable to read advisory relayer balance', expect.any(Error));
 expect(m.createContractExecutionTransaction).toHaveBeenCalledTimes(1);
});
