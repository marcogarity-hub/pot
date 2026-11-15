import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcilePot, RECONCILE_INTERVAL_MS, RECONCILE_TIMEOUT_MS } from './reconcile';

const input = { title: 'Cabin', memberEmails: ['a@example.com', 'b@example.com'], circleTransactionId: 'ctx-1' };
const json = (body: unknown, status: number) => new Response(JSON.stringify(body), { status });

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('reconcilePot', () => {
  it('posts the id it was given and returns created on 201', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ potId: '42', inviteToken: 'tok' }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const outcome = await reconcilePot(input, { isCancelled: () => false });
    expect(outcome).toEqual({ kind: 'created', potId: '42', inviteToken: 'tok' });
    expect(fetchMock).toHaveBeenCalledWith('/api/pots/reconcile', expect.objectContaining({ method: 'POST' }));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(input);
  });

  it('treats 200 (already recorded) as created', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ potId: '42', inviteToken: 'tok' }, 200)));
    expect(await reconcilePot(input, { isCancelled: () => false })).toEqual({ kind: 'created', potId: '42', inviteToken: 'tok' });
  });

  it('polls every 5 s on 202 and 503 until it gets 201', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ error: 'StillPending' }, 202))
      .mockResolvedValueOnce(json({ message: 'retry' }, 503))
      .mockResolvedValueOnce(json({ potId: '42', inviteToken: 'tok' }, 201));
    vi.stubGlobal('fetch', fetchMock);
    const promise = reconcilePot(input, { isCancelled: () => false });
    await vi.advanceTimersByTimeAsync(RECONCILE_INTERVAL_MS * 2);
    expect(await promise).toEqual({ kind: 'created', potId: '42', inviteToken: 'tok' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('returns not-created on 409 CreateFailed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ error: 'CreateFailed' }, 409)));
    expect(await reconcilePot(input, { isCancelled: () => false })).toEqual({ kind: 'not-created' });
  });

  it('stops on 422 MembersMismatch without polling again', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ error: 'MembersMismatch' }, 422));
    vi.stubGlobal('fetch', fetchMock);
    const outcome = await reconcilePot(input, { isCancelled: () => false });
    expect(outcome.kind).toBe('stop');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('stops on 403 without polling again', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ error: 'Forbidden' }, 403));
    vi.stubGlobal('fetch', fetchMock);
    expect((await reconcilePot(input, { isCancelled: () => false })).kind).toBe('stop');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('times out after about 2 minutes of retryable responses', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ error: 'StillPending' }, 202));
    vi.stubGlobal('fetch', fetchMock);
    const promise = reconcilePot(input, { isCancelled: () => false });
    await vi.advanceTimersByTimeAsync(RECONCILE_TIMEOUT_MS + RECONCILE_INTERVAL_MS);
    expect(await promise).toEqual({ kind: 'timeout' });
    // One call at t=0, then one every 5 s until the 120 s budget is spent.
    expect(fetchMock).toHaveBeenCalledTimes(RECONCILE_TIMEOUT_MS / RECONCILE_INTERVAL_MS + 1);
  });

  it('stops polling once the viewer has left', async () => {
    const fetchMock = vi.fn().mockResolvedValue(json({ error: 'StillPending' }, 202));
    vi.stubGlobal('fetch', fetchMock);
    let cancelled = false;
    const promise = reconcilePot(input, { isCancelled: () => cancelled });
    await vi.advanceTimersByTimeAsync(1);
    cancelled = true;
    await vi.advanceTimersByTimeAsync(RECONCILE_INTERVAL_MS * 3);
    expect(await promise).toEqual({ kind: 'cancelled' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
