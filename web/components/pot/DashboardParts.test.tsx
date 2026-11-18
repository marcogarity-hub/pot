import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { ActivityItem, QueueItem } from './dashboardModel';
import { formatDollars } from '@/lib/format/money';
import { ActivityFeed, HeldSummary, NeedsYou, StartTiles } from './DashboardParts';

afterEach(() => cleanup());

const ZERO_COUNTS = { funding: 0, locked: 0, payout: 0, released: 0, closed: 0 };

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

describe('HeldSummary', () => {
  it('says the viewer is in no pots when there are none', () => {
    render(<HeldSummary held={BigInt(0)} potCount={0} needsCount={0} counts={ZERO_COUNTS} />);
    expect(screen.getByText('You are not in any pot yet.', { exact: false })).toBeInTheDocument();
  });

  it('uses the singular for one pot and says nothing needs you', () => {
    render(<HeldSummary held={BigInt(0)} potCount={1} needsCount={0} counts={ZERO_COUNTS} />);
    expect(screen.getByText('$0 held in 1 pot', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Nothing needs you.')).toBeInTheDocument();
  });

  it('uses the singular "needs" for one action and the plural for several', () => {
    const { unmount } = render(<HeldSummary held={BigInt(0)} potCount={2} needsCount={1} counts={ZERO_COUNTS} />);
    expect(screen.getByText('$0 held in 2 pots', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('1 needs you.')).toBeInTheDocument();
    unmount();
    render(<HeldSummary held={BigInt(0)} potCount={3} needsCount={2} counts={ZERO_COUNTS} />);
    expect(screen.getByText('2 need you.')).toBeInTheDocument();
  });

  it('shows the held amount in dollars with the pot count', () => {
    render(<HeldSummary held={BigInt('2500000000000000000')} potCount={1} needsCount={0} counts={ZERO_COUNTS} />);
    expect(screen.getByText('$2.50 held in 1 pot', { exact: false })).toBeInTheDocument();
    expect(screen.queryByText(/USDC/)).toBeNull();
  });

  it('lists each stage with its pot count', () => {
    render(<HeldSummary held={BigInt(0)} potCount={6} needsCount={0} counts={{ funding: 1, locked: 2, payout: 3, released: 0, closed: 0 }} />);
    const stage = (label: string) => screen.getByText(label).nextElementSibling?.textContent;
    expect(stage('Funding')).toBe('1');
    expect(stage('Locked')).toBe('2');
    expect(stage('Payout')).toBe('3');
    expect(stage('Released')).toBe('0');
    expect(stage('Closed')).toBe('0');
  });
});

const queueItem = (over: Partial<QueueItem> = {}): QueueItem => ({
  potId: '7', potTitle: 'Cabin', action: 'pay', label: 'Pay your share',
  hint: '$100, closes in 2 days', href: '/pots/7', urgency: 70, ...over,
});

describe('NeedsYou', () => {
  it('shows the empty state when nothing needs the viewer', () => {
    render(<NeedsYou items={[]} />);
    expect(screen.getByRole('heading', { name: /needs you/i })).toBeInTheDocument();
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders each action as a link to its pot with the label and hint', () => {
    render(<NeedsYou items={[
      queueItem(),
      queueItem({ potId: '9', potTitle: 'Dinner', action: 'refund', label: 'Claim your refund', hint: 'Get your $20 back', href: '/pots/9' }),
    ]} />);
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/pots/7');
    expect(within(links[0]).getByText('Pay your share')).toBeInTheDocument();
    expect(within(links[0]).getByText('Cabin · $100, closes in 2 days')).toBeInTheDocument();
    expect(links[1]).toHaveAttribute('href', '/pots/9');
    expect(within(links[1]).getByText('Claim your refund')).toBeInTheDocument();
  });
});

describe('StartTiles', () => {
  it('links the start tile to /new and the booking tile to /new?preset=booking', () => {
    render(<StartTiles />);
    expect(screen.getByRole('link', { name: /start a pot/i })).toHaveAttribute('href', '/new');
    expect(screen.getByRole('link', { name: /plan a real booking/i })).toHaveAttribute('href', '/new?preset=booking');
  });
});

const activity = (over: Partial<ActivityItem> = {}): ActivityItem => ({
  id: '3', potId: '7', potTitle: 'Cabin', text: 'org@example.com created this pot', tone: 'neutral', ...over,
});

describe('ActivityFeed', () => {
  it('shows the empty state when there are no events', () => {
    render(<ActivityFeed items={[]} />);
    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument();
    expect(screen.getByText('Payments and payouts in your pots show up here.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
  });

  it('renders events newest first as links to their pot', () => {
    render(<ActivityFeed items={[
      activity({ id: '5', text: 'You paid $100', tone: 'money' }),
      activity({ id: '4', potId: '9', potTitle: 'Dinner', text: 'The payout is frozen', tone: 'bad' }),
    ]} />);
    const rows = screen.getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText('You paid $100')).toBeInTheDocument();
    expect(within(rows[0]).getByText('Cabin')).toBeInTheDocument();
    expect(within(rows[0]).getByRole('link')).toHaveAttribute('href', '/pots/7');
    expect(within(rows[1]).getByRole('link')).toHaveAttribute('href', '/pots/9');
  });
});
