import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { HistoryItem } from '@/components/pot/historyModel';
import type { HistoryState } from '@/components/pot/useHistory';

const state: { current: HistoryState } = { current: { items: [], loading: true, error: false, retry: () => {} } };
vi.mock('@/components/pot/useHistory', () => ({ useHistory: () => state.current }));

import { PaymentsSection } from './PaymentsSection';

afterEach(() => {
  cleanup();
  state.current = { items: [], loading: true, error: false, retry: () => {} };
});

const U = (n: number) => (BigInt(n) * BigInt(10) ** BigInt(18)).toString();
const paid = (id: string, potId: string, amount: string): HistoryItem => ({ id, kind: 'paid', potId, potTitle: `Pot ${potId}`, amount, at: null });

describe('PaymentsSection', () => {
  it('shows loading while the history loads', () => {
    render(<PaymentsSection />);
    expect(screen.getByRole('heading', { name: 'Payments' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading your payments');
  });

  it('shows the full list with a summary of what was paid across plans', () => {
    state.current = {
      items: [paid('3', '7', U(210)), paid('2', '8', U(40)), { ...paid('1', '7', U(210)), kind: 'refunded' }],
      loading: false, error: false, retry: () => {},
    };
    render(<PaymentsSection />);
    expect(screen.getByText("You've paid $250 across 2 plans")).toBeInTheDocument();
    expect(screen.getByText('You paid $210')).toBeInTheDocument();
    expect(screen.getByText('You got a refund of $210')).toBeInTheDocument();
  });

  it('omits the summary when it cannot be computed exactly', () => {
    state.current = {
      items: [{ id: '1', kind: 'paid', potId: '7', potTitle: 'Pot 7', at: null }],
      loading: false, error: false, retry: () => {},
    };
    render(<PaymentsSection />);
    expect(screen.queryByText(/You've paid/)).not.toBeInTheDocument();
    expect(screen.getByText('You paid your share')).toBeInTheDocument();
  });

  it('shows the calm empty state', () => {
    state.current = { items: [], loading: false, error: false, retry: () => {} };
    render(<PaymentsSection />);
    expect(screen.getByText('Payments and receipts will show up here.')).toBeInTheDocument();
  });
});
