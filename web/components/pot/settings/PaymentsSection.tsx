'use client';

import { HistoryList, HistoryStatus, HistorySummary } from '@/components/pot/History';
import { useHistory, type HistoryState } from '@/components/pot/useHistory';

/** Settings > Payments: the full list with a one-line total. Pure view over `state`. */
export function PaymentsView({ state }: { state: HistoryState }) {
  return (
    <section aria-labelledby="payments-title" className="space-y-4">
      <h2 id="payments-title" className="text-[22px] font-semibold">Payments</h2>
      {!state.loading && !state.error && <HistorySummary items={state.items} />}
      <div className="rounded-group bg-card px-4">
        <HistoryStatus state={state} />
        {!state.loading && !state.error && state.items.length > 0 && <HistoryList items={state.items} />}
      </div>
    </section>
  );
}

/** Your payments and receipts, read through the browser client. Takes no props. */
export function PaymentsSection() {
  const state = useHistory();
  return <PaymentsView state={state} />;
}
