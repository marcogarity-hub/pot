import { beforeEach, expect, it, vi } from 'vitest';
import { nonceManager } from 'viem';
vi.mock('server-only', () => ({}));
const m = vi.hoisted(() => ({ sendTransaction: vi.fn(), writeContract: vi.fn(), getBalance: vi.fn(), receipt: vi.fn(), estimateFeesPerGas: vi.fn(), privateKeyToAccount: vi.fn() }));
vi.mock('viem', async (original) => ({ ...await original<typeof import('viem')>(), createWalletClient: () => m, createPublicClient: () => ({ getBalance: m.getBalance, waitForTransactionReceipt: m.receipt, estimateFeesPerGas: m.estimateFeesPerGas }) }));
vi.mock('viem/accounts', async (original) => {
 const actual = await original<typeof import('viem/accounts')>();
 m.privateKeyToAccount.mockImplementation(actual.privateKeyToAccount);
 return { ...actual, privateKeyToAccount: m.privateKeyToAccount };
});
import { prefund, relayerFinalize, resetPrefundBudget, PrefundRefusedError } from './index';
import { configurePotInterface } from '../circle/contract';
import { potAbi, arcTestnet } from '../circle/__mocks__/pot';
const to = '0x1111111111111111111111111111111111111111';
beforeEach(() => { vi.clearAllMocks(); resetPrefundBudget(); configurePotInterface({ abi: potAbi, chain: arcTestnet }); process.env.RELAYER_PRIVATE_KEY = `0x${'11'.repeat(32)}`; process.env.PREFUND_DAILY_CAP = '2'; process.env.NEXT_PUBLIC_POT_ADDRESS = to; m.estimateFeesPerGas.mockResolvedValue({ maxFeePerGas: BigInt(10000000000), maxPriorityFeePerGas: BigInt(1000000000) }); m.sendTransaction.mockResolvedValue('0x1234'); m.receipt.mockResolvedValue({ status: 'success' }); m.getBalance.mockResolvedValue(BigInt(10) ** BigInt(18)); });
it('prefunds one USDC by default, confirms, and meets fee floor', async () => { await prefund(to); expect(m.sendTransaction).toHaveBeenCalledWith(expect.objectContaining({ to, value: BigInt(10) ** BigInt(18), maxFeePerGas: BigInt(20000000000) })); expect(m.receipt).toHaveBeenCalled(); });
it('rejects zero address without sending', async () => { await expect(prefund(`0x${'0'.repeat(40)}`)).rejects.toThrow(); expect(m.sendTransaction).not.toHaveBeenCalled(); });
it('reserves the cap before concurrent sends', async () => { const results = await Promise.allSettled([prefund(to),prefund(to),prefund(to)]); expect(results.filter(x=>x.status==='rejected')).toHaveLength(1); expect(m.sendTransaction).toHaveBeenCalledTimes(2); });
it('warns below five USDC when finalizing', async () => { const warn = vi.spyOn(console,'warn').mockImplementation(()=>{}); m.writeContract.mockResolvedValue('0x1234'); await relayerFinalize(BigInt(1)); expect(warn).toHaveBeenCalled(); warn.mockRestore(); });
it('demo principal top-up is separate from the daily gas allowance budget',async()=>{
 const { topup }=await import('./topup');await topup(to,'300');await prefund(to,BigInt(2)*BigInt(10)**BigInt(18));expect(m.sendTransaction).toHaveBeenNthCalledWith(1,expect.objectContaining({value:BigInt(300)*BigInt(10)**BigInt(18)}));
});

it('builds both concurrent prefund accounts with viem nonceManager', async () => {
 await Promise.all([prefund(to), prefund(to)]);
 expect(m.privateKeyToAccount).toHaveBeenCalledTimes(2);
 for (const call of m.privateKeyToAccount.mock.calls) {
  expect(call).toEqual([process.env.RELAYER_PRIVATE_KEY, { nonceManager }]);
 }
 expect(m.sendTransaction).toHaveBeenCalledTimes(2);
});
it('uses fee estimates above the floor for funding and finalization', async () => {
 m.estimateFeesPerGas.mockResolvedValue({ maxFeePerGas: BigInt(45000000000), maxPriorityFeePerGas: BigInt(2000000000) });
 m.getBalance.mockResolvedValue(BigInt(10) ** BigInt(19));
 await prefund(to); await relayerFinalize(BigInt(1));
 expect(m.sendTransaction).toHaveBeenCalledWith(expect.objectContaining({ maxFeePerGas: BigInt(45000000000) }));
 expect(m.writeContract).toHaveBeenCalledWith(expect.objectContaining({ maxFeePerGas: BigInt(45000000000) }));
});
it('never undercuts the fee floor when finalizing', async () => {
 m.getBalance.mockResolvedValue(BigInt(10) ** BigInt(19));
 await relayerFinalize(BigInt(1));
 expect(m.writeContract).toHaveBeenCalledWith(expect.objectContaining({ maxFeePerGas: BigInt(20000000000) }));
});
it.each(['zero address', 'non-positive amount', 'cap', 'missing key'])('classifies %s as a pre-send refusal', async (reason) => {
 if (reason === 'cap') process.env.PREFUND_DAILY_CAP = '0';
 if (reason === 'missing key') delete process.env.RELAYER_PRIVATE_KEY;
 await expect(prefund(reason === 'zero address' ? `0x${'0'.repeat(40)}` : to, reason === 'non-positive amount' ? BigInt(0) : undefined)).rejects.toBeInstanceOf(PrefundRefusedError);
 expect(m.sendTransaction).not.toHaveBeenCalled();
});
it('does not classify an ambiguous send failure as a refusal', async () => {
 const failure = new Error('connection lost after submission');
 m.sendTransaction.mockRejectedValueOnce(failure);
 await expect(prefund(to)).rejects.toBe(failure);
});
