'use client';

import Link from 'next/link';
import { Dialog } from '@base-ui/react/dialog';
import { X } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from 'cn';
import { historySentence, paidSummary, type HistoryItem } from './historyModel';
import { useHistory, type HistoryState } from './useHistory';

const LATEST = 3;

/** "Jul 4, 2026". Only used when an item has a time, which today none does. */
function formatDate(iso: string): string | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Loading, error, and empty states, shared by the widget, its drawer and the Payments section. */
export function HistoryStatus({ state }: { state: HistoryState }) {
  if (state.loading) return <p role="status" className="text-[15px] text-muted-foreground">Loading your payments…</p>;
  if (state.error) {
    return (
      <div className="space-y-3">
        <p role="alert" className="text-[15px] text-muted-foreground">We couldn&apos;t load your payments.</p>
        <Button variant="outline" onClick={state.retry}>Try again</Button>
      </div>
    );
  }
  if (state.items.length === 0) return <p className="text-[15px] text-muted-foreground">Payments and receipts will show up here.</p>;
  return null;
}

function HistoryRow({ item, withReceipt }: { item: HistoryItem; withReceipt: boolean }) {
  const date = item.at ? formatDate(item.at) : null;
  return (
    <li className="space-y-1 py-3">
      <p className="text-[17px]">{historySentence(item)}</p>
      <p className="flex flex-wrap gap-x-2 text-[15px] text-muted-foreground">
        <Link href={`/pots/${item.potId}`} className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {item.potTitle}
        </Link>
        {item.at && date && <time dateTime={item.at}>{date}</time>}
      </p>
      {withReceipt && item.receiptText && (
        <div className="mt-2 rounded-thumb bg-muted px-3 py-2">
          <p className="text-[13px] text-muted-foreground">Receipt</p>
          <p className="text-[15px] whitespace-pre-wrap">{item.receiptText}</p>
        </div>
      )}
    </li>
  );
}

/** The list of movements, newest first. `limit` shows only the first few; receipts are shown when `withReceipts` is set. */
export function HistoryList({ items, limit, withReceipts = true }: { items: HistoryItem[]; limit?: number; withReceipts?: boolean }) {
  const shown = limit === undefined ? items : items.slice(0, limit);
  return (
    <ul className="divide-y divide-border">
      {shown.map(item => <HistoryRow key={item.id} item={item} withReceipt={withReceipts} />)}
    </ul>
  );
}

/**
 * Dashboard card: the latest few movements, and a drawer with the full list. Pure view over `state`.
 * `surface` is the card's background class (a tint on the dashboard); `className` adds placement.
 */
export function HistoryWidget({ state, defaultOpen = false, surface = 'bg-card', className }: {
  state: HistoryState; defaultOpen?: boolean; surface?: string; className?: string;
}) {
  const hasItems = !state.loading && !state.error && state.items.length > 0;
  return (
    <section aria-labelledby="history-title" className={cn('rounded-group p-5', surface, className)}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="history-title" className="text-[22px] font-semibold">History</h2>
        {hasItems && (
          <Dialog.Root defaultOpen={defaultOpen}>
            <Dialog.Trigger className={buttonVariants({ variant: 'ghost' })}>See all</Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/30" />
              <Dialog.Popup className="glass-sheet fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-4 overflow-y-auto rounded-l-sheet p-6 outline-none md:p-8">
                <div className="flex items-center justify-between gap-3">
                  <Dialog.Title className="text-[22px] font-semibold">History</Dialog.Title>
                  <Dialog.Close aria-label="Close" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }))}>
                    <X className="size-5" aria-hidden />
                  </Dialog.Close>
                </div>
                <Dialog.Description className="text-[15px] text-muted-foreground">Every payment, refund and payout on your plans.</Dialog.Description>
                <HistoryList items={state.items} />
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        )}
      </div>
      <div className="mt-3">
        <HistoryStatus state={state} />
        {hasItems && <HistoryList items={state.items} limit={LATEST} withReceipts={false} />}
      </div>
    </section>
  );
}

/** Dashboard widget. Reads the viewer's history itself, so it works on any page. */
export function History({ defaultOpen, surface, className }: { defaultOpen?: boolean; surface?: string; className?: string }) {
  const state = useHistory();
  return <HistoryWidget state={state} defaultOpen={defaultOpen} surface={surface} className={className} />;
}

/** The one-line total for the Payments section, or null when it cannot be computed exactly. */
export function HistorySummary({ items }: { items: HistoryItem[] }) {
  const summary = paidSummary(items);
  if (!summary) return null;
  return (
    <p className="money text-[17px]">
      You&apos;ve paid {summary.total} across {summary.plans} {summary.plans === 1 ? 'plan' : 'plans'}
    </p>
  );
}
