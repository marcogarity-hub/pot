import { afterEach, expect, it, vi } from 'vitest';
import { decodeFunctionResult, encodeFunctionResult } from 'viem';
import { potAbi, arcTestnet } from '@/lib/pot';
import { potInterface, configurePotInterface } from './contract';

const m = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('viem', async original => ({ ...await original<typeof import('viem')>(), createPublicClient: vi.fn(() => ({ readContract: m.read })) }));
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it('defaults to the generated ABI and shared Arc chain without configuration', () => {
 expect(potInterface().abi).toBe(potAbi);
 expect(potInterface().chain).toBe(arcTestnet);
});

it('retains interface injection for tests and rejects other chains', () => {
 configurePotInterface({ abi: [], chain: arcTestnet });
 expect(potInterface().abi).toEqual([]);
 expect(() => configurePotInterface({ abi: [], chain: { ...arcTestnet, id: 1 } })).toThrow('Expected Arc testnet');
 configurePotInterface({ abi: potAbi, chain: arcTestnet });
});

it('fails clearly when the shared deployed address is unset', async () => {
 vi.stubEnv('NEXT_PUBLIC_POT_ADDRESS', undefined);
 const { potAddress } = await import('./contract');
 expect(() => potAddress()).toThrow('NEXT_PUBLIC_POT_ADDRESS is not configured.');
});

it('reads the deployed address exported by the shared Pot module', async () => {
 const address = '0xf842F699128A2e575d20BcC92F0472C7ad59e5C8';
 vi.stubEnv('NEXT_PUBLIC_POT_ADDRESS', address);
 const { potAddress } = await import('./contract');
 expect(potAddress()).toBe(address.toLowerCase());
});

it('reads named fields from the real ABI PotView wire tuple in contract order', async () => {
 const address = '0x1111111111111111111111111111111111111111';
 vi.stubEnv('NEXT_PUBLIC_POT_ADDRESS', address);
 const { readPot: read } = await import('./read');
 // Distinct values catch shifted fields, especially state/counts/timestamps.
 const wire = encodeFunctionResult({ abi: potAbi, functionName: 'getPot', result: {
  organizer: address, total: BigInt(30), share: BigInt(10), deadline: BigInt(100),
  threshold: BigInt(2), objectionWindow: BigInt(60), requestWindow: BigInt(120),
  lockedAt: BigInt(200), state: 4, paymentsCount: BigInt(3), objectionsCount: BigInt(1),
  receiptHash: `0x${'a'.repeat(64)}`, releaseEligibleAt: BigInt(260), members: [address],
 } });
 m.read.mockResolvedValue(decodeFunctionResult({ abi: potAbi, functionName: 'getPot', data: wire }));
 expect(await read(BigInt(42))).toMatchObject({ organizer: address, share: BigInt(10),
  state: 4, threshold: BigInt(2), objectionsCount: BigInt(1), releaseEligibleAt: BigInt(260) });
 expect(m.read).toHaveBeenCalledWith({ address, abi: potAbi, functionName: 'getPot', args: [BigInt(42)] });
});
