import { afterEach, describe, expect, it, vi } from 'vitest';
import { postJson } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('postJson', () => {
  it('exposes the error body so callers can read fields like circleTransactionId', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: 'CreatePending', message: 'wait', circleTransactionId: 'ctx-1' }), { status: 502 },
    )));
    const res = await postJson('/api/pots', {});
    expect(res.ok).toBe(false);
    if (res.ok) return;
    expect(res.status).toBe(502);
    expect(res.body).toMatchObject({ error: 'CreatePending', circleTransactionId: 'ctx-1' });
  });

  it('keeps potId and transactionHash from a 503 body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'recover', potId: '42', transactionHash: '0xabc' }), { status: 503 },
    )));
    const res = await postJson('/api/pots', {});
    if (res.ok) throw new Error('expected failure');
    expect(res.body).toMatchObject({ potId: '42', transactionHash: '0xabc' });
  });

  it('returns an empty body on a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    const res = await postJson('/api/pots', {});
    if (res.ok) throw new Error('expected failure');
    expect(res.status).toBe(0);
    expect(res.body).toEqual({});
  });
});
