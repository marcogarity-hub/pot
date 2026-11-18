import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ClosingSoon } from './ClosingSoon';
import type { ClosingPot } from './dashboardModel';

afterEach(() => cleanup());

const NOW = Date.parse('2026-11-18T12:00:00Z');
const DAY = 86_400_000;

describe('ClosingSoon', () => {
  it('shows a calm empty card when no plan is closing soon, so the column stays balanced', () => {
    render(<ClosingSoon pots={[]} now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Closing soon' })).toBeInTheDocument();
    expect(screen.getByText('Nothing closes in the next week.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('lists each pot with its paid count, time left, and a link to the pot', () => {
    const pots: ClosingPot[] = [
      { potId: '4', title: 'Lake house', paid: 2, members: 4, deadlineAt: NOW + 2 * DAY },
      { potId: '5', title: 'Dinner', paid: 0, members: 3, deadlineAt: NOW + 5 * 3_600_000 },
    ];
    render(<ClosingSoon pots={pots} now={NOW} />);
    expect(screen.getByRole('heading', { name: 'Closing soon' })).toBeInTheDocument();
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/pots/4');
    expect(within(rows[0]).getByText('Lake house')).toBeInTheDocument();
    expect(within(rows[0]).getByText('2 of 4 paid')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Closes in 2 days')).toBeInTheDocument();
    expect(within(rows[1]).getByText('Closes in 5 h')).toBeInTheDocument();
  });
});
