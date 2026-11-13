import { beforeEach, expect, it, vi } from 'vitest';
import { encodeErrorResult, parseUnits } from 'viem';
import { potAbi, arcTestnet } from './__mocks__/pot';
const m = vi.hoisted(() => ({ createWallets: vi.fn(), createContractExecutionTransaction: vi.fn(), getTransaction: vi.fn(), estimateContractExecutionFee: vi.fn(), receipt: vi.fn() }));
vi.mock('@circle-fin/developer-controlled-wallets', () => ({ initiateDeveloperControlledWalletsClient: () => m }));
vi.mock('viem', async (original) => ({ ...await original<typeof import('viem')>(), createPublicClient: () => ({ waitForTransactionReceipt: m.receipt }) }));
import { configurePotInterface } from './contract';
import { callPot } from './tx';
import { createWallet } from './wallets';
beforeEach(() => {
 vi.clearAllMocks(); configurePotInterface({ abi: potAbi, chain: arcTestnet });
 process.env.NEXT_PUBLIC_POT_ADDRESS = '0x1111111111111111111111111111111111111111';
 process.env.CIRCLE_API_KEY = 'test'; process.env.CIRCLE_ENTITY_SECRET = 'test'; process.env.CIRCLE_WALLET_SET_ID = 'set';
 m.estimateContractExecutionFee.mockResolvedValue({ data: { medium: { gasLimit: '100000', maxFee: '1', priorityFee: '1' } } });
 m.createContractExecutionTransaction.mockResolvedValue({ data: { id: 'tx' } });
 m.getTransaction.mockResolvedValue({ data: { transaction: { state: 'COMPLETE', txHash: '0x1234' } } });
 m.receipt.mockResolvedValue({ status: 'success', logs: [{ data: '0x', topics: [] }] });
});
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
