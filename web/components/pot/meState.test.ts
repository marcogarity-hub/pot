import { describe, expect, it, vi } from 'vitest';
import { fetchMeState, meStateFromResponse } from './meState';

const READY = { email: 'a@example.com', wallet_address: '0x00000000000000000000000000000000000000a1' };

describe('meStateFromResponse', () => {
  it('200 with an email and wallet → ready', () => {
    expect(meStateFromResponse(200, READY)).toEqual({ kind: 'ready', ...READY });
  });

  it('200 with a malformed body → error, never ready', () => {
    expect(meStateFromResponse(200, { email: 'a@example.com' })).toEqual({ kind: 'error' });
    expect(meStateFromResponse(200, null)).toEqual({ kind: 'error' });
  });

  it('401 → signed-out', () => {
    expect(meStateFromResponse(401, { error: 'Unauthorized' })).toEqual({ kind: 'signed-out' });
  });

  it('404 NoWallet → no-wallet (signed in, no wallet yet)', () => {
    expect(meStateFromResponse(404, { error: 'NoWallet' })).toEqual({ kind: 'no-wallet' });
  });

  it('404 NoWallet with an email echoes it', () => {
    expect(meStateFromResponse(404, { error: 'NoWallet', email: 'a@example.com' })).toEqual({ kind: 'no-wallet', email: 'a@example.com' });
  });

  it('404 with any other error body → error, not no-wallet', () => {
    expect(meStateFromResponse(404, { error: 'SomethingElse' })).toEqual({ kind: 'error' });
    expect(meStateFromResponse(404, {})).toEqual({ kind: 'error' });
  });

  it('5xx → error (retry, never sign-in)', () => {
    expect(meStateFromResponse(500, { error: 'InternalServerError' })).toEqual({ kind: 'error' });
    expect(meStateFromResponse(503, null)).toEqual({ kind: 'error' });
  });
});

describe('fetchMeState', () => {
  it('maps a network failure to error', async () => {
    const fetchFn = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchMeState(fetchFn)).resolves.toEqual({ kind: 'error' });
  });

  it('maps a 200 whose body is not JSON to error', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response('<html>', { status: 200 }));
    await expect(fetchMeState(fetchFn)).resolves.toEqual({ kind: 'error' });
  });

  it('calls /api/wallet/me and maps the response', async () => {
    const fetchFn = vi.fn().mockResolvedValue(Response.json(READY, { status: 200 }));
    await expect(fetchMeState(fetchFn)).resolves.toEqual({ kind: 'ready', ...READY });
    expect(fetchFn).toHaveBeenCalledWith('/api/wallet/me', expect.objectContaining({ cache: 'no-store' }));
  });
});
