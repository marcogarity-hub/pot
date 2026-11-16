import { describe, expect, it } from 'vitest';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { PotState } from '@/lib/pot/chain';
import { lifecycleSteps } from './PotLifecycle';

const NOW = Date.parse('2030-01-01T00:00:00Z');
const base = {
  pot_id: '1', deadline: '2030-01-02T00:00:00Z', threshold: 1, objection_window_seconds: 120, request_window_seconds: 120,
  locked_at: null, receipt_hash: null, release_eligible_at: null, receipt_text: null, members: [],
} as unknown as PotStatusRow;

const at = (over: Partial<PotStatusRow>) => ({ ...base, ...over }) as PotStatusRow;

describe('lifecycleSteps', () => {
  it('Funding: first stage is current and shows the deadline countdown', () => {
    const steps = lifecycleSteps(at({ state: PotState.Funding }), NOW);
    expect(steps.map(s => s.status)).toEqual(['current', 'next', 'next', 'next']);
    expect(steps[0].detail).toBe('Deadline in 1d 0h');
  });

  it('Locked: earlier stage is done and the request window is the detail', () => {
    const steps = lifecycleSteps(at({ state: PotState.Locked, locked_at: '2029-12-31T23:59:00Z', request_window_seconds: 600 }), NOW);
    expect(steps.map(s => s.status)).toEqual(['done', 'current', 'next', 'next']);
    expect(steps[1].detail).toBe('Request within 9m 00s');
  });

  it('Released: every stage is done with no detail', () => {
    const steps = lifecycleSteps(at({ state: PotState.Released }), NOW);
    expect(steps.every(s => s.status === 'done')).toBe(true);
    expect(steps.every(s => s.detail === null)).toBe(true);
  });

  it('Expired: keeps two reached stages and ends in one Expired stage', () => {
    const steps = lifecycleSteps(at({ state: PotState.Frozen, receipt_hash: null }), NOW);
    expect(steps).toEqual([
      { label: 'Funding', status: 'done', detail: null },
      { label: 'Locked', status: 'done', detail: null },
      { label: 'Expired', status: 'end', detail: null },
    ]);
  });

  it('Frozen after a payout request: keeps three stages and ends in Frozen', () => {
    const hash = '0x' + 'ab'.repeat(32);
    const steps = lifecycleSteps(at({ state: PotState.Frozen, receipt_hash: hash }), NOW);
    expect(steps.map(s => s.label)).toEqual(['Funding', 'Locked', 'Payout requested', 'Frozen']);
    expect(steps[3].status).toBe('end');
  });
});
