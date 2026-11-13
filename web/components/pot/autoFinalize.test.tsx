import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import { finalizeJitterMs, useAutoFinalize } from './autoFinalize';

const FINALIZE_RETRY_MS = 10_000;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 409 })));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('finalizeJitterMs', () => {
  it('is deterministic per pot and stays within 0–3000 ms', () => {
    for (const id of ['0', '1', '7', '42', '999999']) {
      const ms = finalizeJitterMs(id);
      expect(ms).toBeGreaterThanOrEqual(0);
      expect(ms).toBeLessThanOrEqual(3000);
      expect(finalizeJitterMs(id)).toBe(ms);
    }
  });
});

describe('useAutoFinalize', () => {
  it('fires after the jitter, then every 10 s, and stops once finalize is no longer available', async () => {
    const fetchMock = vi.mocked(fetch);
    const jitter = finalizeJitterMs('7');
    const { rerender } = renderHook(({ eligible }) => useAutoFinalize('7', eligible), { initialProps: { eligible: true } });

    // Nothing before the jitter has elapsed.
    await vi.advanceTimersByTimeAsync(jitter > 0 ? jitter - 1 : 0);
    expect(fetchMock).toHaveBeenCalledTimes(0);

    // First tick at the jitter, then one per 10 s.
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(FINALIZE_RETRY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(FINALIZE_RETRY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenCalledWith('/api/pots/7/finalize', expect.objectContaining({ method: 'POST' }));

    // Once finalize stops being available, the interval is cleared.
    rerender({ eligible: false });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never fires while not eligible', async () => {
    const fetchMock = vi.mocked(fetch);
    renderHook(() => useAutoFinalize('7', false));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
