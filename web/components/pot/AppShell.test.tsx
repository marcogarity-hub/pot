import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AppShell, useOpenSettings } from './AppShell';

const m = vi.hoisted(() => ({ pathname: '/' }));
vi.mock('next/navigation', () => ({
  usePathname: () => m.pathname,
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/components/pot/useMe', () => ({ useMe: () => ({ me: null, loading: true, retry: vi.fn() }) }));

afterEach(() => {
  cleanup();
  m.pathname = '/';
});

const me = { name: 'Ana', email: 'ana@example.com' };

describe('AppShell', () => {
  it('renders the page children and the sidebar', () => {
    render(<AppShell me={me} pots={[{ id: '7', title: 'Cabin' }]}><p>Page body</p></AppShell>);
    expect(screen.getByText('Page body')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
  });

  it('has a phone tab bar with Trips, New and You, with the current page marked', () => {
    m.pathname = '/new';
    render(<AppShell me={me} pots={[]}><p>x</p></AppShell>);
    const bar = screen.getByRole('navigation', { name: 'Main' });
    expect(within(bar).getByRole('link', { name: 'Trips' })).toHaveAttribute('href', '/');
    expect(within(bar).getByRole('link', { name: 'New' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar).getByRole('link', { name: 'Trips' })).not.toHaveAttribute('aria-current');
    expect(within(bar).getByRole('button', { name: 'You' })).toBeInTheDocument();
  });

  it('opens Settings on Profile from the You tab', () => {
    render(<AppShell me={me} pots={[]}><p>x</p></AppShell>);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'You' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument();
  });

  it('opens Help from the account menu in the sidebar, in the same dialog', () => {
    render(<AppShell me={me} pots={[]}><p>x</p></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Ana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Splitting costs with Pot' })).toBeInTheDocument();
  });

  it('closes the dialog from its close button', () => {
    render(<AppShell me={me} pots={[]}><p>x</p></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'You' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('drops the phone tab bar when a page floats its own action bar', () => {
    render(<AppShell me={me} pots={[]} hideTabBar><p>x</p></AppShell>);
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('lets a page inside the frame open Settings on a section', () => {
    function Banner() {
      const open = useOpenSettings();
      return <button type="button" onClick={() => open('profile')}>Add your name</button>;
    }
    render(<AppShell me={me} pots={[]}><Banner /></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Add your name' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument();
  });
});
