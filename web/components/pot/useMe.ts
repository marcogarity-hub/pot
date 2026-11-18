'use client';

import { useCallback, useEffect, useState } from 'react';
import { useDemo } from './demo/DemoContext';
import { fetchMeState, type MeState } from './meState';

export type { MeState } from './meState';

/**
 * The signed-in user's wallet state. `me` is null only while the first request is in flight.
 * `retry` re-requests after an `error`.
 */
export function useMe(): { me: MeState | null; loading: boolean; retry: () => void } {
  const demo = useDemo();
  const [me, setMe] = useState<MeState | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (demo) return;
    let cancelled = false;
    void fetchMeState().then(state => { if (!cancelled) setMe(state); });
    return () => { cancelled = true; };
  }, [attempt, demo]);
  const retry = useCallback(() => {
    setMe(null);
    setAttempt(n => n + 1);
  }, []);
  if (demo) return { me: { kind: 'ready', email: demo.email, wallet_address: demo.wallet }, loading: false, retry };
  return { me, loading: me === null, retry };
}
