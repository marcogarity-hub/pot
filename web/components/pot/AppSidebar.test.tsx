import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AppSidebar } from './AppSidebar';

const m = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({
  usePathname: () => m.pathname,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  m.pathname = '/';
});

const me = { name: 'Ana', email: 'ana@example.com' };

describe('AppSidebar', () => {
  it('has the wordmark linking home and the one New plan action', () => {
    render(<AppSidebar me={me} onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Pot' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'New plan' })).toHaveAttribute('href', '/new');
    expect(screen.queryByRole('link', { name: 'New pot' })).toBeNull();
  });

  it('lists Home, History, Wallet and Help as page links under New plan', () => {
    render(<AppSidebar me={me} onOpenSettings={vi.fn()} />);
    const nav = screen.getByRole('navigation', { name: 'Sections' });
    const links = within(nav).getAllByRole('link');
    expect(links.map(l => l.textContent)).toEqual(['Home', 'History', 'Wallet', 'Help']);
    expect(links.map(l => l.getAttribute('href'))).toEqual(['/', '/history', '/wallet', '/help']);
    expect(within(nav).queryAllByRole('button')).toHaveLength(0);
    expect(screen.queryByRole('navigation', { name: 'Your pots' })).toBeNull();
  });

  it('marks Home as the current page only on /', () => {
    render(<AppSidebar me={me} onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');
  });

  it('does not mark Home on another page', () => {
    m.pathname = '/new';
    render(<AppSidebar me={me} onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('marks the page the visitor is on, and only that one', () => {
    m.pathname = '/wallet';
    render(<AppSidebar me={me} onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('link', { name: 'Wallet' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'History' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Help' })).not.toHaveAttribute('aria-current');
  });

  it('opens the account menu from the account trigger', () => {
    render(<AppSidebar me={me} onOpenSettings={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ana' }));
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('is hidden below md, where the tab bar takes over', () => {
    render(<AppSidebar me={me} onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toHaveClass('hidden', 'md:flex');
  });
});
