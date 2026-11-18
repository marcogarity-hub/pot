import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DashboardStrip } from './DashboardStrip';

afterEach(() => cleanup());

describe('DashboardStrip', () => {
  it('links to the create flow and the booking preset', () => {
    render(<DashboardStrip held={BigInt(0)} heldPots={0} primary={false} />);
    expect(screen.getByRole('link', { name: 'Start a pot' })).toHaveAttribute('href', '/new');
    expect(screen.getByRole('link', { name: 'Plan a real booking' })).toHaveAttribute('href', '/new?preset=booking');
  });

  it('shows the held amount and the pot count when money is held', () => {
    render(<DashboardStrip held={BigInt('2500000000000000000')} heldPots={1} primary={false} />);
    expect(screen.getByText('$2.50', { exact: true })).toBeInTheDocument();
    expect(screen.getByText(/held across 1 pot$/)).toBeInTheDocument();
  });

  it('uses the plural for several pots', () => {
    render(<DashboardStrip held={BigInt('1000000000000000000')} heldPots={3} primary={false} />);
    expect(screen.getByText(/held across 3 pots$/)).toBeInTheDocument();
  });

  it('hides the held line when nothing is held', () => {
    render(<DashboardStrip held={BigInt(0)} heldPots={0} primary={false} />);
    expect(screen.queryByText(/held across/)).toBeNull();
  });

  it('keeps Start a pot as the solid primary action only when the person has no pots', () => {
    const { unmount } = render(<DashboardStrip held={BigInt(0)} heldPots={0} primary />);
    expect(screen.getByRole('link', { name: 'Start a pot' }).className).toContain('glass-prominent');
    unmount();
    render(<DashboardStrip held={BigInt(0)} heldPots={0} primary={false} />);
    expect(screen.getByRole('link', { name: 'Start a pot' }).className).not.toContain('glass-prominent');
  });
});
