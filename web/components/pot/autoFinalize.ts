import { useEffect } from 'react';
import { finalizePot } from './finalize';

const FINALIZE_RETRY_MS = 10_000;

/**
 * Deterministic 0–3000 ms offset derived from the pot id. Viewers of the same pot don't all
 * fire at the same instant, and tests can rely on the value.
 */
export function finalizeJitterMs(potId: string): number {
  let hash = 0;
  for (const ch of potId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 3001;
}

/**
 * A9: no per-minute cron on Hobby, so an open status page retries finalize while eligible.
 * The first tick waits for the jitter, then one tick every 10 s. Cleanup stops the timers
 * once finalize is no longer available.
 */
export function useAutoFinalize(potId: string, eligible: boolean) {
  useEffect(() => {
    if (!eligible) return;
    const tick = () => { void finalizePot(potId); };
    let interval: ReturnType<typeof setInterval> | undefined;
    const first = setTimeout(() => {
      tick();
      interval = setInterval(tick, FINALIZE_RETRY_MS);
    }, finalizeJitterMs(potId));
    return () => {
      clearTimeout(first);
      if (interval !== undefined) clearInterval(interval);
    };
  }, [potId, eligible]);
}
