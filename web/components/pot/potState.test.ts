import { describe, expect, it } from 'vitest';
import { PotState } from '@/lib/pot/chain';
import { stateInfo } from './potState';

const base = { state: PotState.Funding, receipt_hash: null } as const;

describe('stateInfo', () => {
  it('labels each contract state in plain words', () => {
    expect(stateInfo({ ...base, state: PotState.Funding }).label).toBe('Funding');
    expect(stateInfo({ ...base, state: PotState.Locked }).label).toBe('Locked');
    expect(stateInfo({ ...base, state: PotState.PayoutRequested }).label).toBe('Payout requested');
    expect(stateInfo({ ...base, state: PotState.Released }).label).toBe('Released');
    expect(stateInfo({ ...base, state: PotState.Frozen, receipt_hash: '0xabc' }).label).toBe('Frozen');
  });

  it('shows Expired for a frozen pot that never got a payout request (expire sets Frozen with no receipt)', () => {
    expect(stateInfo({ ...base, state: PotState.Frozen, receipt_hash: null }).label).toBe('Expired');
    const zero = '0x' + '0'.repeat(64);
    expect(stateInfo({ ...base, state: PotState.Frozen, receipt_hash: zero }).label).toBe('Expired');
  });

  it('explains what happens next for every state', () => {
    for (const state of [PotState.Funding, PotState.Locked, PotState.PayoutRequested, PotState.Released, PotState.Frozen]) {
      expect(stateInfo({ ...base, state, receipt_hash: '0xabc' }).next.length).toBeGreaterThan(20);
    }
    expect(stateInfo({ ...base, state: PotState.Frozen, receipt_hash: null }).next).toMatch(/money back/i);
  });
});
