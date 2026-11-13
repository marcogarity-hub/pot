'use client';

import { useCallback, useEffect, useState } from 'react';
import { fetchMeState, type MeState } from './meState';

export type { MeState } from './meState';

/**
 * The signed-in user's wallet state. `me` is null only while the first request is in flight.
 * `retry` re-requests after an `error`.
 */
export function useMe(): { me: MeState | null; loading: boolean; retry: () => void } {
  const [me, setMe] = useState<MeState | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    void fetchMeState().then(state => { if (!cancelled) setMe(state); });
    return () => { cancelled = true; };
  }, [attempt]);
  const retry = useCallback(() => {
    setMe(null);
    setAttempt(n => n + 1);
  }, []);
  return { me, loading: me === null, retry };
}
