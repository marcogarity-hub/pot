vi.mock('@/lib/pot', async original => ({ ...await original<typeof import('@/lib/pot')>(), get POT_ADDRESS() { return process.env.NEXT_PUBLIC_POT_ADDRESS; } }));
import { beforeEach, expect, it, vi } from 'vitest';
import { keccak256, parseUnits, toBytes } from 'viem';
const m = vi.hoisted(() => ({ server: vi.fn(), admin: vi.fn(), ensureUser: vi.fn(), getWalletUser: vi.fn(), callPot: vi.fn(), finalize: vi.fn(), read: vi.fn(), block: vi.fn(), from: vi.fn(), update: vi.fn(), upsert: vi.fn(), saved: vi.fn(), leaver: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: m.server }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: m.admin }));
vi.mock('@/lib/circle/identity', () => ({ ensureUser: m.ensureUser, getWalletUser: m.getWalletUser }));
vi.mock('@/lib/circle/tx', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/circle/tx')>(), callPot: m.callPot }));
vi.mock('@/lib/relayer', () => ({ relayerFinalize: m.finalize }));
vi.mock('viem', async importOriginal => ({ ...await importOriginal<typeof import('viem')>(), createPublicClient: () => ({ readContract: m.read, getBlock: m.block }) }));
import { PotRevertError } from '@/lib/circle/tx';
import { POST as pay } from './[potId]/pay/route';
import { POST as refund } from './[potId]/refund/route';
import { POST as object } from './[potId]/object/route';
import { POST as expire } from './[potId]/expire/route';
import { POST as release } from './[potId]/request-release/route';
import { POST as swap } from './[potId]/swap/route';
import { POST as finalize } from './[potId]/finalize/route';
import { toHttp } from './errors';
const org = '0x1111111111111111111111111111111111111111';
const old = '0x2222222222222222222222222222222222222222';
const replacement = '0x3333333333333333333333333333333333333333';
const hash = `0x${'a'.repeat(64)}`;
const pot = () => ({ organizer: org, share: parseUnits('300', 18), state: 1, threshold: BigInt(5), objectionsCount: BigInt(0), releaseEligibleAt: BigInt(1000) });
type Handler = typeof pay;
const post = (handler: Handler, body?: unknown, potId = '42') => handler(new Request('https://pot.test/api/pots/42', { method: 'POST', ...(body === undefined ? {} : { body: JSON.stringify(body) }) }), { params: Promise.resolve({ potId }) });
beforeEach(() => {
 vi.resetAllMocks();  process.env.NEXT_PUBLIC_POT_ADDRESS = org;
 m.server.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'auth', email: ' Organizer@x.com ' } }, error: null }) } });
 m.ensureUser.mockImplementation(async (email: string) => ({ circle_wallet_id: email === 'replacement@x.com' ? 'replacement-wallet' : 'caller-wallet', wallet_address: email === 'replacement@x.com' ? replacement : org }));
 m.getWalletUser.mockResolvedValue({ circle_wallet_id: 'caller-wallet', wallet_address: org });
 m.read.mockResolvedValue(pot()); m.block.mockResolvedValue({ timestamp: BigInt(1000) });
 m.callPot.mockResolvedValue({ transactionHash: hash }); m.finalize.mockResolvedValue(hash);
 m.saved.mockResolvedValue({ data: { pot_id: '42' }, error: null }); m.leaver.mockResolvedValue({ data: { wallet_address: old }, error: null });
 m.update.mockReturnValue({ eq: () => ({ select: () => ({ single: m.saved }) }) }); m.upsert.mockResolvedValue({ error: null });
 m.from.mockImplementation(() => ({ update: m.update, upsert: m.upsert, select: () => ({ eq: () => ({ maybeSingle: m.leaver }) }) }));
 m.admin.mockReturnValue({ from: m.from });
});
it('pay reads the chain share and sends exact value from the caller wallet', async () => {
 expect((await post(pay)).status).toBe(200);
 expect(m.read).toHaveBeenCalledWith(expect.objectContaining({ address: org, functionName: 'getPot', args: [BigInt(42)] }));
 expect(m.getWalletUser).toHaveBeenCalledWith(' Organizer@x.com '); expect(m.ensureUser).not.toHaveBeenCalled();
 expect(m.callPot).toHaveBeenCalledWith('caller-wallet', 'pay', [BigInt(42)], parseUnits('300', 18));
});
it.each([['AlreadyPaid', "You've already paid into this pot."], ['DeadlinePassed', 'The deadline has passed.']])('maps pay revert %s to 409', async (code, message) => {
 m.callPot.mockRejectedValue(new PotRevertError(code)); const response = await post(pay); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: code, message });
});
it.each([pay, refund, object, expire, release, swap])('requires authentication before wallet calls', async handler => {
 m.server.mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
 expect((await post(handler)).status).toBe(401); expect(m.ensureUser).not.toHaveBeenCalled(); expect(m.callPot).not.toHaveBeenCalled();
});
it.each([pay, refund, object, expire])('does not provision or prefund a caller on %s', async handler => {
 const response = await post(handler);
 expect(response.status).toBe(200); expect(m.getWalletUser).toHaveBeenCalledTimes(1); expect(m.ensureUser).not.toHaveBeenCalled();
});
it('uses read-only caller lookup for object and does not provision', async()=>{
 expect((await post(object)).status).toBe(200); expect(m.getWalletUser).toHaveBeenCalledTimes(1); expect(m.ensureUser).not.toHaveBeenCalled();
});
it('returns 403 for an authenticated caller without a wallet', async()=>{
 m.getWalletUser.mockResolvedValueOnce(null);
 const response=await post(pay); expect(response.status).toBe(403); expect(await response.json()).toEqual({error:'NotAMember',message:"You're not part of this pot."});
 expect(m.ensureUser).not.toHaveBeenCalled(); expect(m.callPot).not.toHaveBeenCalled();
});
it.each([[refund, 'refund'], [object, 'object'], [expire, 'expire']] as const)('signs simple actions with caller wallet', async (handler, fn) => {
 expect((await post(handler)).status).toBe(200); expect(m.callPot).toHaveBeenCalledWith('caller-wallet', fn, [BigInt(42)]);
});
it.each([release, swap])('refuses a non-organizer before tx or replacement provisioning', async handler => {
 m.read.mockResolvedValue({ ...pot(), organizer: old });
 expect((await post(handler, { receiptText: 'receipt', leaverEmail: 'old@x.com', replacementEmail: 'replacement@x.com' })).status).toBe(403);
 expect(m.callPot).not.toHaveBeenCalled(); expect(m.getWalletUser).toHaveBeenCalledTimes(1); expect(m.ensureUser).not.toHaveBeenCalled(); expect(m.update).not.toHaveBeenCalled();
});
it('does not save receipt text after a failed requestRelease', async () => {
 m.callPot.mockRejectedValue(new PotRevertError('WrongState'));
 expect((await post(release, { receiptText: 'Airbnb conf HMX123' })).status).toBe(409); expect(m.update).not.toHaveBeenCalled();
});
it('hashes exact receipt text and saves only after confirmation', async () => {
 let confirm!: (value: unknown) => void;
 m.callPot.mockReturnValue(new Promise(resolve => { confirm = resolve; }));
 const response = post(release, { receiptText: 'Airbnb conf HMX123' });
 await vi.waitFor(() => expect(m.callPot).toHaveBeenCalled()); expect(m.update).not.toHaveBeenCalled();
 confirm({ transactionHash: hash }); expect((await response).status).toBe(200);
 expect(m.callPot).toHaveBeenCalledWith('caller-wallet', 'requestRelease', [BigInt(42), keccak256(toBytes('Airbnb conf HMX123'))]);
 expect(m.update).toHaveBeenCalledWith({ receipt_text: 'Airbnb conf HMX123' }); expect(m.from).toHaveBeenCalledWith('pot_meta');
});
it.each(['', 'x'.repeat(501), 12])('validates receipt input %s', async receiptText => {
 expect((await post(release, { receiptText })).status).toBe(400); expect(m.callPot).not.toHaveBeenCalled();
});
it('requires Locked state for receipt request', async () => {
 m.read.mockResolvedValue({ ...pot(), state: 0 }); expect((await post(release, { receiptText: 'receipt' })).status).toBe(409); expect(m.callPot).not.toHaveBeenCalled();
});
it('reports recovery details when confirmed receipt metadata cannot be saved', async () => {
 m.saved.mockResolvedValue({ data: null, error: null }); const response = await post(release, { receiptText: 'receipt' });
 expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ potId: '42', transactionHash: hash });
});
it('finalize requires no auth and refuses before the chain window', async () => {
 m.read.mockResolvedValue({ ...pot(), state: 2 }); m.block.mockResolvedValue({ timestamp: BigInt(999) });
 const response = await post(finalize); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: 'NotEligible' }); expect(m.finalize).not.toHaveBeenCalled(); expect(m.server).not.toHaveBeenCalled();
});
it('finalizes at the exact window boundary', async () => {
 m.read.mockResolvedValue({ ...pot(), state: 2 }); expect((await post(finalize)).status).toBe(200); expect(m.finalize).toHaveBeenCalledWith(BigInt(42));
});
it('single-flights concurrent finalize requests for the same pot', async () => {
 m.read.mockResolvedValue({ ...pot(), state: 2 });
 let confirm!: (value: unknown) => void;
 m.finalize.mockReturnValue(new Promise(resolve => { confirm = resolve; }));
 const first = post(finalize); const second = post(finalize);
 await vi.waitFor(() => expect(m.finalize).toHaveBeenCalledTimes(1));
 confirm(hash);
 const responses = await Promise.all([first, second]);
 expect(responses.map(r => r.status)).toEqual([200, 200]);
 expect(await Promise.all(responses.map(r => r.json()))).toEqual([{ transactionHash: hash }, { transactionHash: hash }]);
 expect(m.finalize).toHaveBeenCalledTimes(1);
 expect(responses[0]).not.toBe(responses[1]);
});
it.each([{ state: 0 }, { state: 1 }, { state: 4 }, { state: 2, objectionsCount: BigInt(5) }])('refuses ineligible finalize', async patch => {
 m.read.mockResolvedValue({ ...pot(), ...patch }); expect((await post(finalize)).status).toBe(409); expect(m.finalize).not.toHaveBeenCalled();
});
it('returns alreadyFinalized for Released', async () => {
 m.read.mockResolvedValue({ ...pot(), state: 3 }); const response = await post(finalize); expect(response.status).toBe(200); expect(await response.json()).toEqual({ alreadyFinalized: true }); expect(m.finalize).not.toHaveBeenCalled();
});
it('swaps normalized email wallets and upserts invitation after confirmation', async () => {
 const response = await post(swap, { leaverEmail: ' OLD@x.com ', replacementEmail: ' REPLACEMENT@x.com ' }); expect(response.status).toBe(200);
 expect(m.ensureUser).toHaveBeenCalledWith('replacement@x.com'); expect(m.callPot).toHaveBeenCalledWith('caller-wallet', 'swapSeat', [BigInt(42), old, replacement]);
 expect(m.from).toHaveBeenCalledWith('pot_invites');
 expect(m.upsert).toHaveBeenCalledWith({ pot_id: '42', address: replacement, email: 'replacement@x.com' }, { onConflict: 'pot_id,address' });
});
it('does not write invitation on failed swap', async () => {
 m.callPot.mockRejectedValue(new PotRevertError('FormerMember')); expect((await post(swap, { leaverEmail: 'old@x.com', replacementEmail: 'replacement@x.com' })).status).toBe(409); expect(m.upsert).not.toHaveBeenCalled();
});
it.each(['-1', '1.5', 'abc', (BigInt(2) ** BigInt(256)).toString()])('rejects invalid uint256 id %s', async id => {
 expect((await post(pay, undefined, id)).status).toBe(400); expect(m.callPot).not.toHaveBeenCalled();
});
it('hides unexpected provider errors', async () => {
 const response = toHttp(new Error('secret')); expect(response.status).toBe(500); expect(JSON.stringify(await response.json())).not.toContain('secret');
});
it.each([['WindowClosed', 'The objection window has closed.'], ['FormerMember', 'That person has already left this pot.'], ['WrongState', 'WrongState']])('maps %s centrally', async (code, message) => {
 const response = toHttp(new PotRevertError(code)); expect(response.status).toBe(409); expect(await response.json()).toEqual({ error: code, message });
});

it('returns AlreadyPaid for the second pay', async () => {
 expect((await post(pay)).status).toBe(200);
 m.callPot.mockRejectedValueOnce(new PotRevertError('AlreadyPaid'));
 const response = await post(pay); expect(response.status).toBe(409);
 expect(await response.json()).toEqual({ error: 'AlreadyPaid', message: "You've already paid into this pot." });
});
it('keeps swap metadata untouched until confirmation', async () => {
 let confirm!: (value: unknown) => void;
 m.callPot.mockReturnValue(new Promise(resolve => { confirm = resolve; }));
 const response = post(swap, { leaverEmail: 'old@x.com', replacementEmail: 'replacement@x.com' });
 await vi.waitFor(() => expect(m.callPot).toHaveBeenCalled()); expect(m.upsert).not.toHaveBeenCalled();
 confirm({ transactionHash: hash }); expect((await response).status).toBe(200); expect(m.upsert).toHaveBeenCalledTimes(1);
});
it('reports confirmed swap hash on invite persistence failure', async () => {
 m.upsert.mockResolvedValue({ error: { message: 'offline' } });
 const response = await post(swap, { leaverEmail: 'old@x.com', replacementEmail: 'replacement@x.com' });
 expect(response.status).toBe(503); expect(await response.json()).toMatchObject({ potId: '42', transactionHash: hash });
});
it('does not provision a missing leaver', async () => {
 m.leaver.mockResolvedValue({ data: null, error: null });
 expect((await post(swap, { leaverEmail: 'missing@x.com', replacementEmail: 'replacement@x.com' })).status).toBe(400);
 expect(m.getWalletUser).toHaveBeenCalledTimes(1); expect(m.ensureUser).not.toHaveBeenCalled(); expect(m.callPot).not.toHaveBeenCalled();
});
it('rejects invalid replacement wallets before signing', async () => {
 m.getWalletUser.mockResolvedValueOnce({ circle_wallet_id: 'caller', wallet_address: org }); m.ensureUser.mockResolvedValueOnce({ circle_wallet_id: 'replacement', wallet_address: `0x${'0'.repeat(40)}` });
 expect((await post(swap, { leaverEmail: 'old@x.com', replacementEmail: 'replacement@x.com' })).status).toBe(400); expect(m.callPot).not.toHaveBeenCalled();
});
it('does not relay after an unexpected chain read failure', async () => {
 m.read.mockRejectedValue(new Error('RPC unavailable'));
 expect((await post(finalize)).status).toBe(500); expect(m.finalize).not.toHaveBeenCalled();
});
it('refuses a mismatched getPot return shape', async () => {
 m.read.mockResolvedValue({ ...pot(), share: '300000000000000000000' });
 expect((await post(pay)).status).toBe(500); expect(m.callPot).not.toHaveBeenCalled();
});

it.each([
 ['pay', pay], ['refund', refund], ['object', object], ['expire', expire],
 ['request-release', release], ['swap', swap], ['finalize', finalize],
] as const)('returns 404 for a missing pot on %s', async (_action, handler) => {
 m.read.mockResolvedValue({ ...pot(), organizer: `0x${'0'.repeat(40)}` });
 const response = await post(handler, { receiptText: 'receipt', leaverEmail: 'old@x.com', replacementEmail: 'replacement@x.com' });
 expect(response.status).toBe(404);
 expect(await response.json()).toEqual({ error: 'PotNotFound' });
 expect(m.callPot).not.toHaveBeenCalled(); expect(m.finalize).not.toHaveBeenCalled();
 expect(m.getWalletUser.mock.calls.every(([email]) => email === ' Organizer@x.com ')).toBe(true); expect(m.ensureUser).not.toHaveBeenCalled();
 expect(m.update).not.toHaveBeenCalled(); expect(m.upsert).not.toHaveBeenCalled();
});

it('returns alreadyFinalized when a competing finalize wins before the relayer reverts', async () => {
 m.read.mockResolvedValueOnce({ ...pot(), state: 2 }).mockResolvedValueOnce({ ...pot(), state: 3 });
 m.finalize.mockRejectedValueOnce(new PotRevertError('WrongState'));
 const response = await post(finalize);
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({ alreadyFinalized: true });
 expect(m.read).toHaveBeenCalledTimes(2);
 expect(m.finalize).toHaveBeenCalledTimes(1);
});
it.each([
 [new PotRevertError('WrongState'), 409, { error: 'WrongState', message: 'WrongState' }],
 [new Error('secret'), 500, { error: 'InternalServerError', message: 'The request could not be completed.' }],
] as const)('preserves error mapping after a failed finalize if the pot is still unreleased', async (error, status, body) => {
 m.read.mockResolvedValue({ ...pot(), state: 2 });
 m.finalize.mockRejectedValueOnce(error);
 const response = await post(finalize);
 expect(response.status).toBe(status); expect(await response.json()).toEqual(body);
 expect(m.read).toHaveBeenCalledTimes(2);
});

it('preserves the relayer error when the finalize re-read fails', async () => {
 m.read.mockResolvedValueOnce({ ...pot(), state: 2 }).mockRejectedValueOnce(new Error('RPC unavailable'));
 m.finalize.mockRejectedValueOnce(new PotRevertError('WrongState'));
 const response = await post(finalize);
 expect(response.status).toBe(409);
 expect(await response.json()).toEqual({ error: 'WrongState', message: 'WrongState' });
 expect(m.read).toHaveBeenCalledTimes(2);
});

it.each([pay, refund, object, expire, release, swap, finalize])('returns 503 before wallet or chain calls when the address is unset', async handler => {
 delete process.env.NEXT_PUBLIC_POT_ADDRESS;
 const response = await post(handler);
 expect(response.status).toBe(503);
 expect(await response.json()).toMatchObject({ error: 'PotUnavailable', message: 'NEXT_PUBLIC_POT_ADDRESS is not configured.' });
 expect(m.ensureUser).not.toHaveBeenCalled();
 expect(m.getWalletUser).not.toHaveBeenCalled();
 expect(m.read).not.toHaveBeenCalled();
});
