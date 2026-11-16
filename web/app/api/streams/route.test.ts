// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import allEventsFixture from './__fixtures__/arc-logs.json';
import { decodePotLogs } from './decode';
const fixture = { data: [[[...allEventsFixture.data[0][0].slice(0, 2)]]] };
import { abi, address, created, event, alice } from './test-support';
import { createStreamsHandler } from './handler';
import { memoryStore, supabaseStore, type PotStore } from './store';
import { verifyQuickNode } from './verify';
import { foldPot } from './fold';
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: vi.fn() }));
import { createAdminSupabase } from '@/lib/supabase/admin';
const secret = 'test-stream-secret';
function request(payload: unknown = fixture, gzip = false) {
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const headers = new Headers({ 'X-QN-Nonce': 'nonce', 'X-QN-Timestamp': '1800000000', 'X-QN-Signature': createHmac('sha256', secret).update('nonce1800000000' + body).digest('hex') });
  if (gzip) headers.set('Content-Encoding', 'gzip');
  return new Request('http://localhost/api/streams', { method: 'POST', headers, body: gzip ? new Uint8Array(gzipSync(body)) : body });
}
const handler = (store: PotStore) => createStreamsHandler({ abi, potAddress: address, secret, store });
beforeEach(() => vi.clearAllMocks());
describe('Streams HTTP', () => {
  it('valid signature and gzip decode the fixture', async () => {
    for (const gzip of [false, true]) {
      const store = memoryStore();
      const response = await handler(store)(request(fixture, gzip));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ events: 2, pots: 1 });
      expect(store.projections.get('1')?.pot.payments_count).toBe(1);
    }
  });
  it('ingests every deployed-contract event from the complete fixture end to end', async () => {
    const store = memoryStore();
    const post = handler(store);
    const response = await post(request(allEventsFixture));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ events: 22, pots: 3 });
    expect(store.projections.get('1')?.pot).toMatchObject({ state: 3, payments_count: 2 });
    expect(store.projections.get('2')?.pot).toMatchObject({ state: 4, objections_count: 1 });
    expect(store.projections.get('3')?.pot.state).toBe(4);
    const first = structuredClone([...store.projections]);
    expect((await post(request(allEventsFixture, true))).status).toBe(200);
    expect(store.events.size).toBe(22);
    expect([...store.projections]).toEqual(first);
  });
  it('rejects bad signatures without storing anything', async () => {
    const store = memoryStore();
    const req = request(); req.headers.set('X-QN-Signature', 'bad');
    expect((await handler(store)(req)).status).toBe(401);
    expect(store.events.size).toBe(0);
  });
  it('duplicate delivery does not change rows or counts', async () => {
    const store = memoryStore(); const post = handler(store);
    await post(request()); const first = structuredClone(store.projections.get('1'));
    expect((await post(request())).status).toBe(200);
    expect(store.events.size).toBe(2);
    expect(store.projections.get('1')).toEqual(first);
  });
  it('retry repairs projection after persistence fails', async () => {
    const store = memoryStore(); const write = store.upsertProjection;
    store.upsertProjection = vi.fn().mockRejectedValueOnce(new Error('db unavailable')).mockImplementation(write);
    const post = handler(store);
    expect((await post(request())).status).toBe(500);
    expect(store.events.size).toBe(2);
    expect((await post(request())).status).toBe(200);
    expect(store.projections.get('1')?.pot.payments_count).toBe(1);
  });
  it('skips a deterministic poison pot and projects the other pots', async () => {
    const store = memoryStore();
    const load = store.loadEvents;
    store.loadEvents = vi.fn(async (potId: string) => {
      const history = await load(potId);
      return potId === '2' ? history.map(e => e.name === 'Paid' ? { ...e, args: { ...e.args, member: '0xdddddddddddddddddddddddddddddddddddddddd' } } : e) : history;
    });
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await handler(store)(request(allEventsFixture));
      expect(response.status).toBe(200);
      expect(store.projections.has('1')).toBe(true);
      expect(store.projections.has('3')).toBe(true);
      expect(store.projections.has('2')).toBe(false);
      expect(error).toHaveBeenCalledWith(expect.stringContaining('pot 2'), expect.objectContaining({ name: 'Error' }));
    } finally { error.mockRestore(); }
  });
  it('out-of-order batches converge, including when creation arrives last', async () => {
    const logs = fixture.data[0][0];
    const results = [];
    for (const order of [[logs[0], logs[1]], [logs[1], logs[0]]]) {
      const store = memoryStore(); const post = handler(store);
      for (const log of order) await post(request({ data: [[[log]]] }));
      results.push(store.projections.get('1'));
      expect(store.events.size).toBe(2);
    }
    expect(results[0]).toEqual(results[1]);
  });
  it('rejects malformed JSON and gzip; accepts empty batches', async () => {
    const store = memoryStore();
    expect((await handler(store)(request('{bad'))).status).toBe(400);
    const req = request(); req.headers.set('Content-Encoding', 'gzip');
    expect((await handler(store)(req)).status).toBe(400);
    expect(await (await handler(store)(request({ data: [] }))).json()).toEqual({ events: 0, pots: 0 });
  });
  it('rejects raw and gzip-expanded bodies over 5 MB with 413 before storing events', async () => {
    const oversized = ' '.repeat(5 * 1024 * 1024 + 1);
    for (const gzip of [false, true]) {
      const store = memoryStore();
      expect((await handler(store)(request(oversized, gzip))).status).toBe(413);
      expect(store.events.size).toBe(0);
    }
  });
  it.each([['', secret], [address, ''], ['', '']])('returns 503 for missing configuration (%s, %s)', async (potAddress, token) => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_POT_ADDRESS', potAddress);
    vi.stubEnv('QUICKNODE_STREAM_TOKEN', token);
    try {
      const { POST } = await import('./route');
      expect((await POST(request())).status).toBe(503);
      expect(createAdminSupabase).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });
  it('production route decodes the deployed ABI and persists the fixture', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_POT_ADDRESS', address);
    vi.stubEnv('QUICKNODE_STREAM_TOKEN', secret);
    const events = decodePotLogs(fixture, abi, address);
    const rows = events.map(e => ({ pot_id: e.potId, event_name: e.name, transaction_hash: e.txHash, log_index: e.logIndex, block_number: e.blockNumber, args: e.args }));
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const range = vi.fn().mockResolvedValue({ data: rows, error: null });
    vi.mocked(createAdminSupabase).mockReturnValue({
      from: vi.fn(() => ({ upsert, select: () => ({ eq: () => ({ order: () => ({ range }) }) }) })), rpc,
    } as unknown as ReturnType<typeof createAdminSupabase>);
    try {
      const { POST } = await import('./route');
      const response = await POST(request());
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ events: 2, pots: 1 });
      expect(upsert).toHaveBeenCalledWith(rows, { onConflict: 'transaction_hash,log_index', ignoreDuplicates: true });
      expect(rpc).toHaveBeenCalledWith('apply_pot_projection', expect.objectContaining({ p_pot: expect.objectContaining({ pot_id: '1', payments_count: 1 }) }));
    } finally { vi.unstubAllEnvs(); }
  });

});
describe('verifyQuickNode', () => {
  it('requires all headers, an exact hex digest, an untampered body and a secret', () => {
    const headers = request().headers;
    const raw = JSON.stringify(fixture);
    expect(verifyQuickNode(raw, headers, secret)).toBe(true);
    expect(verifyQuickNode(raw + ' ', headers, secret)).toBe(false);
    expect(verifyQuickNode(raw, headers, '')).toBe(false);
    for (const name of ['X-QN-Nonce', 'X-QN-Timestamp', 'X-QN-Signature']) {
      const missing = new Headers(headers); missing.delete(name);
      expect(verifyQuickNode(raw, missing, secret)).toBe(false);
    }
    for (const signature of ['a', '00'.repeat(33), 'gg'.repeat(32)]) {
      const malformed = new Headers(headers); malformed.set('X-QN-Signature', signature);
      expect(verifyQuickNode(raw, malformed, secret)).toBe(false);
    }
  });
});
describe('stores', () => {
  it('memory store isolates callers and deduplicates transaction hashes case-insensitively', async () => {
    const store = memoryStore();
    await store.insertEvents([created, { ...created, txHash: created.txHash.toUpperCase() }]);
    const events = await store.loadEvents('1'); events[0].args.organizer = 'mutated';
    expect((await store.loadEvents('1'))[0]).toEqual(created);
    expect(store.events.size).toBe(1);
  });
  it('Supabase ignores conflicts, maps exact rows, and atomically guards projection writes', async () => {
    const paid = event('Paid', { member: alice }, 1);
    const rows = [created, paid].map(e => ({ pot_id: e.potId, event_name: e.name, transaction_hash: e.txHash, log_index: e.logIndex, block_number: e.blockNumber, args: e.args }));
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const range = vi.fn().mockResolvedValue({ data: rows, error: null });
    const order = vi.fn(); const eq = vi.fn(() => ({ order }));
    order.mockReturnValue({ range });
    const from = vi.fn(() => ({ upsert, select: vi.fn(() => ({ eq })) }));
    const rpc = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(createAdminSupabase).mockReturnValue({ from, rpc } as unknown as ReturnType<typeof createAdminSupabase>);
    const store = supabaseStore();
    await store.insertEvents([created, paid]);
    expect(upsert).toHaveBeenCalledWith(rows, { onConflict: 'transaction_hash,log_index', ignoreDuplicates: true });
    expect(await store.loadEvents('1')).toEqual([created, paid]);
    expect(order).toHaveBeenCalledWith('id', { ascending: true });
    const { pot, members } = foldPot([created, paid]);
    await store.upsertProjection(pot, members);
    expect(rpc).toHaveBeenCalledWith('apply_pot_projection', { p_pot: expect.objectContaining(pot), p_members: members, p_event_count: 2 });
    rpc.mockResolvedValueOnce({ error: { message: 'stale projection' } });
    await expect(store.upsertProjection(pot, members)).rejects.toThrow('stale projection');
    upsert.mockResolvedValueOnce({ error: { message: 'insert failed' } });
    await expect(store.insertEvents([created])).rejects.toThrow('insert failed');
  });
});
describe('Streams payload shapes and rejection logging', () => {
  it('returns 200 for a correctly signed bare-array body and for {data: {data: [...]}}', async () => {
    const logs = allEventsFixture.data[0][0].slice(0, 2);
    for (const payload of [logs, { data: { data: logs }, metadata: { network: 'arc-testnet' } }]) {
      const store = memoryStore();
      const response = await handler(store)(request(payload));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ events: 2, pots: 1 });
      expect(store.projections.get('1')?.pot.payments_count).toBe(1);
    }
  });
  it('returns 400 for a correctly signed garbage body', async () => {
    const store = memoryStore();
    const response = await handler(store)(request({ foo: 'bar' }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid Streams logs payload' });
    expect(store.events.size).toBe(0);
  });
  it('logs one shape summary without log values on a 400 and keeps the body unchanged', async () => {
    const fixtureLog = allEventsFixture.data[0][0][0];
    const payload = { data: { logs: [fixtureLog] }, metadata: { network: 'arc-testnet' } };
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const response = await handler(memoryStore())(request(payload));
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'Invalid Streams logs payload' });
      expect(error).toHaveBeenCalledTimes(1);
      const line = String(error.mock.calls[0][0]);
      expect(line.startsWith('[api/streams] payload rejected:')).toBe(true);
      expect(line).not.toContain('\n');
      expect(line).toContain('"logs"');
      expect(line).toContain('"metadata"');
      expect(line).toContain('"address"');
      expect(line).not.toContain(fixtureLog.address);
      expect(line).not.toContain(fixtureLog.address.toLowerCase());
      expect(line).not.toContain(fixtureLog.topics[0]);
      expect(line).not.toContain(fixtureLog.data);
      expect(line).not.toContain('arc-testnet');
    } finally { error.mockRestore(); }
  });
  it('logs "not json" with the byte length for an unparseable body', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect((await handler(memoryStore())(request('{bad'))).status).toBe(400);
      expect(error).toHaveBeenCalledTimes(1);
      const line = String(error.mock.calls[0][0]);
      expect(line).toContain('payload rejected:');
      expect(line).toContain('not json');
      expect(line).toContain('4');
      expect(line).not.toContain('bad');
    } finally { error.mockRestore(); }
  });
  it('logs the redacted projection failure with name and message on a 500', async () => {
    vi.stubEnv('SUPABASE_SECRET_KEY', 'sb-secret-value-123');
    vi.stubEnv('QUICKNODE_STREAM_TOKEN', 'short');
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      const store = memoryStore();
      store.insertEvents = vi.fn().mockRejectedValue(new Error('db down sb-secret-value-123 and short'));
      const response = await handler(store)(request());
      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ error: 'Projection failed; retry delivery' });
      const line = error.mock.calls.map(call => String(call[0])).find(text => text.startsWith('[api/streams] projection failed:'));
      expect(line).toBeDefined();
      expect(line).toContain('Error');
      expect(line).toContain('[redacted]');
      expect(line).not.toContain('sb-secret-value-123');
      expect(line).toContain('short');
    } finally { error.mockRestore(); vi.unstubAllEnvs(); }
  });
});
