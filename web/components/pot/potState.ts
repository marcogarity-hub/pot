import { PotState } from '@/lib/pot/chain';

export type StateTone = 'accent' | 'neutral' | 'warning' | 'success' | 'danger';
export type StateInfo = { label: string; tone: StateTone; next: string };

const ZERO_HASH = /^0x0*$/;

/**
 * Plain-language state for the status screen. The contract has five states. `expire` also sets Frozen,
 * and only a payout request writes a receipt hash, so a Frozen pot with no receipt was expired.
 */
export function stateInfo(s: { state: number; receipt_hash: string | null }): StateInfo {
  switch (s.state) {
    case PotState.Funding:
      return { label: 'Funding', tone: 'accent', next: 'Members pay their share before the deadline. If everyone pays, the money locks. If not, everyone who paid can take it back.' };
    case PotState.Locked:
      return { label: 'Locked', tone: 'neutral', next: 'Everyone paid, so the money is locked. The organizer has to request the payout with a receipt before the window closes.' };
    case PotState.PayoutRequested:
      return { label: 'Payout requested', tone: 'warning', next: 'The organizer asked for the payout. Members can object during the window. If too few object, the money goes to the organizer.' };
    case PotState.Released:
      return { label: 'Released', tone: 'success', next: 'The money was released to the organizer. Nothing else happens here.' };
    case PotState.Frozen:
      if (s.receipt_hash === null || ZERO_HASH.test(s.receipt_hash)) {
        return { label: 'Expired', tone: 'danger', next: "The organizer didn't request the payout in time, so the pot expired. Everyone who paid can take their money back." };
      }
      return { label: 'Frozen', tone: 'danger', next: 'Enough members objected, so the payout is frozen. Everyone who paid can take their share back.' };
    default:
      return { label: 'Unknown', tone: 'neutral', next: '' };
  }
}
