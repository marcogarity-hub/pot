import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { QueueItem } from './dashboardModel';
import { formatDollars } from '@/lib/format/money';
import { NeedsYouCards, historyPlacement } from './DashboardParts';

afterEach(() => cleanup());

describe('formatDollars (money on the dashboard)', () => {
  const USDC = BigInt('1000000000000000000');

  it('formats zero as $0', () => {
    expect(formatDollars(BigInt(0))).toBe('$0');
  });

  it('shows amounts under one cent as <$0.01 instead of rounding to zero', () => {
    expect(formatDollars(BigInt('1'))).toBe('<$0.01');
    expect(formatDollars(BigInt('9999999999999999'))).toBe('<$0.01');
  });

  it('keeps exactly one cent as $0.01', () => {
    expect(formatDollars(BigInt('10000000000000000'))).toBe('$0.01');
  });

  it('adds thousands separators and drops empty cents', () => {
    expect(formatDollars(USDC * BigInt(1234) + BigInt('500000000000000000'))).toBe('$1,234.50');
    expect(formatDollars(USDC * BigInt(1234567))).toBe('$1,234,567');
  });

  it('truncates extra decimals instead of rounding up', () => {
    expect(formatDollars(BigInt('1239000000000000000'))).toBe('$1.23');
  });
});

const queueItem = (over: Partial<QueueItem> = {}): QueueItem => ({
  potId: '7', potTitle: 'Cabin', action: 'pay', label: 'Pay your share',
  hint: '$100, closes in 2 days', href: '/pots/7', urgency: 70, dueAt: 2_000, ...over,
});

describe('NeedsYouCards', () => {
  it('shows the empty state and no list when nothing needs the viewer', () => {
    render(<NeedsYouCards items={[]} />);
    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument();
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('shows a single action as a card linking straight to its pot, with the label and hint', () => {
    render(<NeedsYouCards items={[queueItem()]} />);
    const card = screen.getByRole('link', { name: /pay your share/i });
    expect(card).toHaveAttribute('href', '/pots/7');
    expect(within(card).getByText('Pay your share')).toBeInTheDocument();
    expect(within(card).getByText('Cabin · $100, closes in 2 days')).toBeInTheDocument();
    expect(within(card).queryByText(/^\d+$/)).toBeNull();
  });

  it('groups several items of one action into one card with a count, the soonest pot, and a link to the trips list', () => {
    render(<NeedsYouCards items={[
      queueItem({ potId: '7', potTitle: 'Cabin', dueAt: 5_000, hint: '$100, closes in 4 days' }),
      queueItem({ potId: '9', potTitle: 'Dinner', dueAt: 1_000, hint: '$20, closes in 1 day' }),
    ]} />);
    const cards = screen.getAllByRole('link');
    expect(cards).toHaveLength(1);
    expect(cards[0]).toHaveAttribute('href', '#your-pots');
    expect(within(cards[0]).getByText('Pay your share in 2 plans')).toBeInTheDocument();
    expect(within(cards[0]).getByText('Soonest: Dinner, $20, closes in 1 day')).toBeInTheDocument();
    expect(within(cards[0]).getByText('2')).toBeInTheDocument();
  });

  it('keeps one card per action type, in the order each type first appears', () => {
    render(<NeedsYouCards items={[
      queueItem({ potId: '1', action: 'finalize', label: 'Finalize the payout', potTitle: 'Whistler', hint: 'The objection window has ended', href: '/pots/1' }),
      queueItem({ potId: '2', action: 'pay', potTitle: 'Cabin', href: '/pots/2' }),
      queueItem({ potId: '3', action: 'pay', potTitle: 'Lake', href: '/pots/3', dueAt: 9_000 }),
    ]} />);
    const cards = screen.getAllByRole('link');
    expect(cards).toHaveLength(2);
    expect(within(cards[0]).getByText('Finalize the payout')).toBeInTheDocument();
    expect(within(cards[1]).getByText('Pay your share in 2 plans')).toBeInTheDocument();
  });

  it('gives each action type its own soft tint, and the plan cards stay white', () => {
    render(<NeedsYouCards items={[
      queueItem({ potId: '1', action: 'pay', href: '/pots/1' }),
      queueItem({ potId: '2', action: 'finalize', label: 'Finalize the payout', href: '/pots/2' }),
      queueItem({ potId: '3', action: 'refund', label: 'Claim your refund', href: '/pots/3' }),
    ]} />);
    const [pay, finalize, refund] = screen.getAllByRole('link');
    expect(pay).toHaveClass('tint-peach');
    expect(finalize).toHaveClass('tint-rose');
    expect(refund).toHaveClass('tint-sage');
    expect(pay).not.toHaveClass('bg-card');
  });

  it('places the cards two per row and an odd last card across the left half', () => {
    render(<NeedsYouCards items={[
      queueItem({ potId: '1', action: 'pay', href: '/pots/1' }),
      queueItem({ potId: '2', action: 'finalize', label: 'Finalize the payout', href: '/pots/2' }),
      queueItem({ potId: '3', action: 'refund', label: 'Claim your refund', href: '/pots/3' }),
    ]} />);
    const [first, second, third] = screen.getAllByRole('link');
    expect(first).toHaveClass('lg:col-start-1', 'lg:row-start-2');
    expect(second).toHaveClass('lg:col-start-2', 'lg:row-start-2');
    expect(third).toHaveClass('lg:col-span-2', 'lg:col-start-1', 'lg:row-start-3');
  });

  it('gives one card, or none, the whole left half across two rows', () => {
    const { unmount } = render(<NeedsYouCards items={[queueItem()]} />);
    expect(screen.getByRole('link', { name: /pay your share/i })).toHaveClass('lg:row-span-2', 'lg:col-span-2');
    unmount();
    render(<NeedsYouCards items={[]} />);
    expect(screen.getByText('Nothing needs you right now.')).toHaveClass('tint-peach', 'lg:row-span-2');
  });

  it('lines History up under the bottom needs-you card', () => {
    expect(historyPlacement(0)).toContain('lg:row-start-3');
    expect(historyPlacement(3)).toContain('lg:row-start-3');
    expect(historyPlacement(4)).toContain('lg:row-start-3');
    expect(historyPlacement(5)).toContain('lg:row-start-4');
  });
});
