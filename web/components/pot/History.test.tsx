import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HistoryItem } from './historyModel';
import type { HistoryState } from './useHistory';
import { HistoryWidget } from './History';

afterEach(cleanup);

const U = (n: number) => (BigInt(n) * BigInt(10) ** BigInt(18)).toString();
const items: HistoryItem[] = [
  { id: '5', kind: 'payout-received', potId: '7', potTitle: 'Cabin weekend', amount: U(1260), at: null, receiptText: 'Airbnb HMX123' },
  { id: '4', kind: 'refunded', potId: '8', potTitle: 'Camping permits', amount: U(40), at: null },
  { id: '3', kind: 'paid', potId: '9', potTitle: 'Birthday gift', amount: U(12), at: null },
  { id: '2', kind: 'paid', potId: '7', potTitle: 'Cabin weekend', amount: U(210), at: null },
];
const ready = (list: HistoryItem[]): HistoryState => ({ items: list, loading: false, error: false, retry: () => {} });

describe('HistoryWidget', () => {
  it('shows a calm empty state and no See all button', () => {
    render(<HistoryWidget state={ready([])} />);
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(screen.getByText('Payments and receipts will show up here.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'See all' })).not.toBeInTheDocument();
  });

  it('shows loading without claiming an empty list', () => {
    render(<HistoryWidget state={{ items: [], loading: true, error: false, retry: () => {} }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your payments');
    expect(screen.queryByText('Payments and receipts will show up here.')).not.toBeInTheDocument();
  });

  it('offers a retry on error', () => {
    const retry = vi.fn();
    render(<HistoryWidget state={{ items: [], loading: false, error: true, retry }} />);
    expect(screen.getByRole('alert')).toHaveTextContent("We couldn't load your payments.");
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
  });

  it('lists the latest three as sentences with links to their pots', () => {
    render(<HistoryWidget state={ready(items)} />);
    expect(screen.getByText('You received $1,260')).toBeInTheDocument();
    expect(screen.getByText('You got a refund of $40')).toBeInTheDocument();
    expect(screen.getByText('You paid $12')).toBeInTheDocument();
    expect(screen.queryByText('You paid $210')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cabin weekend' })).toHaveAttribute('href', '/pots/7');
    expect(screen.queryByText('Airbnb HMX123')).not.toBeInTheDocument();
  });

  it('opens a drawer with the full list and receipts, and closes it with Escape', () => {
    render(<HistoryWidget state={ready(items)} />);
    fireEvent.click(screen.getByRole('button', { name: 'See all' }));
    const dialog = screen.getByRole('dialog', { name: 'History' });
    expect(within(dialog).getByText('You paid $210')).toBeInTheDocument();
    expect(within(dialog).getByText('Airbnb HMX123')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Close' })).toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'History' })).not.toBeInTheDocument();
  });

  it('opens already open when defaultOpen is set', () => {
    render(<HistoryWidget state={ready(items)} defaultOpen />);
    expect(screen.getByRole('dialog', { name: 'History' })).toBeInTheDocument();
  });
});
