'use client';

import { HistoryList, HistoryStatus, HistorySummary } from '@/components/pot/History';
import { useHistory, type HistoryState } from '@/components/pot/useHistory';

/** The full payments list with a one-line total. Pure view over `state`. `hideHeading` drops its own title when the page already has one. */
export function PaymentsView({ state, hideHeading = false }: { state: HistoryState; hideHeading?: boolean }) {
  return (
    <section aria-labelledby={hideHeading ? undefined : 'payments-title'} className="space-y-4">
      {!hideHeading && <h2 id="payments-title" className="text-[22px] font-semibold">Payments</h2>}
      {!state.loading && !state.error && <HistorySummary items={state.items} />}
      <div className="rounded-group bg-card px-4">
        <HistoryStatus state={state} />
        {!state.loading && !state.error && state.items.length > 0 && <HistoryList items={state.items} />}
      </div>
    </section>
  );
}

/** Your payments and receipts, read through the browser client. */
export function PaymentsSection({ hideHeading = false }: { hideHeading?: boolean }) {
  const state = useHistory();
  return <PaymentsView state={state} hideHeading={hideHeading} />;
}
