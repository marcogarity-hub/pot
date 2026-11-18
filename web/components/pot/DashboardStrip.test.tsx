import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DashboardStrip } from './DashboardStrip';

afterEach(() => cleanup());

describe('DashboardStrip', () => {
  it('links to the create flow and the booking preset', () => {
    render(<DashboardStrip held={BigInt(0)} heldPlans={0} />);
    expect(screen.getByRole('link', { name: 'Start a plan' })).toHaveAttribute('href', '/new');
    expect(screen.getByRole('link', { name: 'Plan a real booking' })).toHaveAttribute('href', '/new?preset=booking');
  });

  it('shows the held amount and the plan count when money is held', () => {
    render(<DashboardStrip held={BigInt('2500000000000000000')} heldPlans={1} />);
    expect(screen.getByText('$2.50', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/held across 1 plan$/)).toBeInTheDocument();
  });

  it('uses the plural for several plans', () => {
    render(<DashboardStrip held={BigInt('1000000000000000000')} heldPlans={3} />);
    expect(screen.getByText(/held across 3 plans$/)).toBeInTheDocument();
  });

  it('hides the held segment and gives the two starts the full width when nothing is held', () => {
    const { container } = render(<DashboardStrip held={BigInt(0)} heldPlans={0} />);
    expect(screen.queryByText(/held across/)).toBeNull();
    expect(container.firstElementChild).toHaveClass('sm:grid-cols-2');
    expect(container.firstElementChild).not.toHaveClass('sm:grid-cols-3');
  });

  it('splits the full width into three equal segments when money is held', () => {
    const { container } = render(<DashboardStrip held={BigInt('1000000000000000000')} heldPlans={2} />);
    expect(container.firstElementChild).toHaveClass('sm:grid-cols-3');
    expect(container.firstElementChild?.children).toHaveLength(3);
  });

  it('is never coral: no segment uses the primary action styling', () => {
    render(<DashboardStrip held={BigInt('1000000000000000000')} heldPlans={1} />);
    for (const link of screen.getAllByRole('link')) {
      expect(link.className).not.toContain('bg-primary');
      expect(link.className).not.toContain('glass-prominent');
    }
  });
});
