import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { usePot } from './usePot';
import { createBrowserSupabase } from '@/lib/supabase/browser';
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function mockClient() {
  const order: string[] = [];
  const changes: Array<() => void> = [];
  let connection!: (state: string) => void;
  const channel = {
    on: vi.fn((_event, _filter, callback: () => void) => { changes.push(callback); return channel; }),
    subscribe: vi.fn((callback: (state: string) => void) => { order.push('subscribe'); connection = callback; return channel; }),
  };
  const maybeSingle = vi.fn().mockResolvedValue({ data: { pot_id: '1', payments_count: 0 }, error: null });
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const db = { channel: vi.fn(() => channel), from: vi.fn(() => { order.push('fetch'); return { select }; }), removeChannel: vi.fn().mockResolvedValue('ok') };
  vi.mocked(createBrowserSupabase).mockReturnValue(db as unknown as ReturnType<typeof createBrowserSupabase>);
  return { db, channel, changes, reconnect: () => connection('SUBSCRIBED'), maybeSingle, eq, select, order };
}
beforeEach(() => vi.clearAllMocks());
describe('usePot', () => {
  it('subscribes before fetching and refetches a change during the initial request', async () => {
    const mock = mockClient();
    const first = deferred<{ data: unknown; error: null }>();
    const second = deferred<{ data: unknown; error: null }>();
    mock.maybeSingle.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = renderHook(() => usePot('1'));
    expect(mock.order.slice(0, 2)).toEqual(['subscribe', 'fetch']);
    expect(mock.channel.on).toHaveBeenCalledWith('postgres_changes', { event: '*', schema: 'public', table: 'pots', filter: 'pot_id=eq.1' }, expect.any(Function));
    expect(mock.channel.on).toHaveBeenCalledWith('postgres_changes', { event: '*', schema: 'public', table: 'pot_members', filter: 'pot_id=eq.1' }, expect.any(Function));
    act(() => mock.changes[0]());
    await act(async () => first.resolve({ data: { pot_id: '1', payments_count: 0 }, error: null }));
    expect(result.current.loading).toBe(true);
    expect(result.current.status).toBeNull();
    await act(async () => second.resolve({ data: { pot_id: '1', payments_count: 1 }, error: null }));
    expect(result.current.status?.payments_count).toBe(1);
    expect(result.current.loading).toBe(false);
  });
  it('refetches after reconnect and every member change, and supports manual refetch', async () => {
    const mock = mockClient(); const { result } = renderHook(() => usePot('1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    mock.maybeSingle.mockResolvedValue({ data: { pot_id: '1', payments_count: 2 }, error: null });
    await act(async () => mock.reconnect());
    expect(result.current.status?.payments_count).toBe(2);
    await act(async () => mock.changes[1]());
    await act(async () => result.current.refetch());
    expect(mock.maybeSingle).toHaveBeenCalledTimes(4);
    expect(mock.eq).toHaveBeenCalledWith('pot_id', '1');
    expect(mock.select).toHaveBeenCalledWith(expect.stringContaining('total::text'));
  });
  it('does not drop a change queued as a fetch finishes', async () => {
    const mock = mockClient();
    const first = deferred<{ data: unknown; error: null }>();
    void first.promise.then(() => queueMicrotask(() => mock.changes[0]()));
    mock.maybeSingle.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ data: { pot_id: '1', payments_count: 3 }, error: null });
    const { result } = renderHook(() => usePot('1'));
    await act(async () => first.resolve({ data: { pot_id: '1', payments_count: 0 }, error: null }));
    await waitFor(() => expect(result.current.status?.payments_count).toBe(3));
  });
  it('removes the channel on unmount and ignores in-flight results', async () => {
    const mock = mockClient(); const first = deferred<{ data: unknown; error: null }>();
    mock.maybeSingle.mockReturnValueOnce(first.promise);
    const { unmount } = renderHook(() => usePot('1'));
    unmount(); expect(mock.db.removeChannel).toHaveBeenCalledWith(mock.channel);
    await act(async () => { first.resolve({ data: { pot_id: '1' }, error: null }); mock.changes[0](); mock.reconnect(); });
    expect(mock.maybeSingle).toHaveBeenCalledTimes(1);
  });
  it('keeps a slow previous pot response from replacing the newly selected pot', async () => {
    const mock = mockClient(); const first = deferred<{ data: unknown; error: null }>();
    mock.maybeSingle.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ data: { pot_id: '2', payments_count: 5 }, error: null });
    const { result, rerender } = renderHook(({ id }) => usePot(id), { initialProps: { id: '1' } });
    rerender({ id: '2' });
    await waitFor(() => expect(result.current.status?.pot_id).toBe('2'));
    await act(async () => first.resolve({ data: { pot_id: '1' }, error: null }));
    expect(result.current.status?.pot_id).toBe('2');
    expect(mock.db.removeChannel).toHaveBeenCalledTimes(1);
  });
  it('finishes loading for missing rows or errors, and can recover on refetch', async () => {
    const mock = mockClient(); mock.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    const { result } = renderHook(() => usePot('1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.status).toBeNull();
    await act(async () => result.current.refetch());
    expect(result.current.status?.pot_id).toBe('1');
    mock.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    await act(async () => result.current.refetch());
    expect(result.current.status).toBeNull();
  });
});
