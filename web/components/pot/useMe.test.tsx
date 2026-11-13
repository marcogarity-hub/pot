import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useMe } from './useMe';

const READY = { email: 'a@example.com', wallet_address: '0x00000000000000000000000000000000000000a1' };

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('useMe', () => {
  it('is loading until the first response, then holds the mapped state', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'Unauthorized' }, { status: 401 })));
    const { result } = renderHook(() => useMe());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.me).toEqual({ kind: 'signed-out' });
  });

  it('retry after a 5xx re-requests and moves to ready', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: 'InternalServerError' }, { status: 500 }))
      .mockResolvedValueOnce(Response.json(READY, { status: 200 }));
    vi.stubGlobal('fetch', fetchFn);
    const { result } = renderHook(() => useMe());
    await waitFor(() => expect(result.current.me).toEqual({ kind: 'error' }));

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.me).toEqual({ kind: 'ready', ...READY }));
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('a 404 NoWallet response is no-wallet, not signed-out', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: 'NoWallet' }, { status: 404 })));
    const { result } = renderHook(() => useMe());
    await waitFor(() => expect(result.current.me).toEqual({ kind: 'no-wallet' }));
  });
});
