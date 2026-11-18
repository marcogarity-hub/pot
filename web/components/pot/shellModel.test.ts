import { describe, expect, it } from 'vitest';
import type { DashboardPot } from './dashboardModel';
import { toShellPots } from './shellModel';

const pot = (id: string, state: number, title: string | null): DashboardPot =>
  ({ pot_id: id, title, state, receipt_hash: null, total: '0', share: '0', members: [] }) as unknown as DashboardPot;

describe('toShellPots', () => {
  it('lists every pot with its state word and flags the ones that need the person', () => {
    const shell = toShellPots([pot('1', 0, 'Cabin'), pot('2', 1, null)], [{ potId: '2' }]);
    expect(shell.map(p => p.id)).toEqual(['1', '2']);
    expect(shell[0]).toMatchObject({ title: 'Cabin', needsYou: false });
    expect(shell[1]).toMatchObject({ title: null, needsYou: true });
    expect(shell[0].stateLabel).toBeTruthy();
  });
  it('is empty for no pots', () => {
    expect(toShellPots([], [])).toEqual([]);
  });
});
