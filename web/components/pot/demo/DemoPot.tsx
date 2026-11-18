'use client';

import { DEMO_WALLET } from '@/lib/demo/data';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { availableActions } from '../actions';
import { useNow } from '../Countdown';
import { PotActions } from '../PotActions';
import { PotPageView } from '../PotPageView';
import { stateInfo } from '../potState';

const noop = () => {};

/**
 * A demo plan page: the real page view and the real action bar, with Alex's sample wallet standing in for a
 * signed-in member. Pressing an action shows its confirmation after a moment; nothing is sent and the plan does not change.
 */
export function DemoPot({ status }: { status: PotStatusRow }) {
  const now = useNow();
  const actions = availableActions(status, DEMO_WALLET, now);
  return (
    <PotPageView
      status={status}
      nowMs={now.getTime()}
      myAddress={DEMO_WALLET}
      isOrganizer={status.organizer_address.toLowerCase() === DEMO_WALLET}
      actions={<PotActions demo potId={status.pot_id} actions={actions} status={status} idleText={stateInfo(status).next} onSettled={noop} />}
      notice={null}
      invite={null}
    />
  );
}
