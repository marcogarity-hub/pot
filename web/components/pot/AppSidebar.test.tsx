import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AppSidebar } from './AppSidebar';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));

afterEach(() => cleanup());

const pots = [
  { id: '7', title: 'Cabin weekend', needsYou: true, stateLabel: 'Funding' },
  { id: '9', title: 'Lake trip' },
  { id: '11', title: null },
];

describe('AppSidebar', () => {
  it('has the wordmark linking home and the one New pot action', () => {
    render(<AppSidebar me={{ name: 'Ana', email: 'ana@example.com' }} pots={pots} onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Pot' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'New pot' })).toHaveAttribute('href', '/new');
  });

  it('lists only pots, with links, a needs-you word and the current pot marked', () => {
    render(<AppSidebar me={{ name: 'Ana', email: 'ana@example.com' }} pots={pots} activePotId="9" onOpenSettings={vi.fn()} />);
    const list = screen.getByRole('navigation', { name: 'Your pots' });
    expect(within(list).getAllByRole('link').map(l => l.getAttribute('href'))).toEqual(['/pots/7', '/pots/9', '/pots/11']);
    expect(within(list).getByRole('link', { name: /Cabin weekend/ })).toHaveTextContent('Needs you · Funding');
    expect(within(list).getByRole('link', { name: /Lake trip/ })).toHaveAttribute('aria-current', 'page');
    expect(within(list).getByRole('link', { name: /Cabin weekend/ })).not.toHaveAttribute('aria-current');
    expect(within(list).getByRole('link', { name: /Untitled pot/ })).toBeInTheDocument();
  });

  it('has no Trips, Activity or You items', () => {
    render(<AppSidebar me={{ name: null, email: 'ana@example.com' }} pots={[]} onOpenSettings={vi.fn()} />);
    expect(screen.queryByRole('link', { name: 'Trips' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Activity' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Your pots' })).toBeNull();
  });

  it('opens the account menu from the account trigger', () => {
    render(<AppSidebar me={{ name: 'Ana', email: 'ana@example.com' }} pots={[]} onOpenSettings={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ana' }));
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('is hidden below md, where the tab bar takes over', () => {
    render(<AppSidebar me={{ name: null, email: 'ana@example.com' }} pots={[]} onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toHaveClass('hidden', 'md:flex');
  });
});
