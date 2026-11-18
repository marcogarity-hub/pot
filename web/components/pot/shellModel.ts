import type { DashboardPot } from './dashboardModel';
import { stateInfo } from './potState';
import type { ShellPot } from './AppSidebar';

/** The sidebar's pot list: every pot with its state word, and a "needs you" cue where the person has something to do. */
export function toShellPots(pots: DashboardPot[], queue: Array<{ potId: string }>): ShellPot[] {
  const needs = new Set(queue.map(item => item.potId));
  return pots.map(p => ({
    id: p.pot_id,
    title: p.title,
    needsYou: needs.has(p.pot_id),
    stateLabel: stateInfo({ state: p.state, receipt_hash: p.receipt_hash }).label,
  }));
}
