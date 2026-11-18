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
    render(<AppShell me={me}><p>Page body</p></AppShell>);
    expect(screen.getByText('Page body')).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
  });

  it('has a phone tab bar with Home, History, New, Help and You, with the current page marked', () => {
    m.pathname = '/new';
    render(<AppShell me={me}><p>x</p></AppShell>);
    const bar = screen.getByRole('navigation', { name: 'Main' });
    const links = within(bar).getAllByRole('link');
    expect(links.map(l => l.getAttribute('href'))).toEqual(['/', '/history', '/new', '/help']);
    expect(within(bar).getByRole('link', { name: 'New' })).toHaveAttribute('aria-current', 'page');
    expect(within(bar).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
    expect(within(bar).getByRole('button', { name: 'You' })).toBeInTheDocument();
  });

  it('marks History in the tab bar on the history page', () => {
    m.pathname = '/history';
    render(<AppShell me={me}><p>x</p></AppShell>);
    expect(within(screen.getByRole('navigation', { name: 'Main' })).getByRole('link', { name: 'History' })).toHaveAttribute('aria-current', 'page');
  });

  it('opens Settings on Profile from the You tab', () => {
    render(<AppShell me={me}><p>x</p></AppShell>);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'You' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument();
  });

  it('links the sidebar rows to their pages rather than opening the dialog', () => {
    render(<AppShell me={me}><p>x</p></AppShell>);
    expect(within(screen.getByRole('navigation', { name: 'Sections' })).getByRole('link', { name: 'Help' })).toHaveAttribute('href', '/help');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens Settings on Privacy from the account menu, in the same dialog', () => {
    render(<AppShell me={me}><p>x</p></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Ana' }));
    const menu = screen.getByRole('button', { name: 'Log out' }).closest('ul') as HTMLElement;
    fireEvent.click(within(menu).getByRole('button', { name: 'Privacy' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Privacy' })).toBeInTheDocument();
  });

  it('closes the dialog from its close button', () => {
    render(<AppShell me={me}><p>x</p></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'You' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('drops the phone tab bar when a page floats its own action bar', () => {
    render(<AppShell me={me} hideTabBar><p>x</p></AppShell>);
    expect(screen.queryByRole('navigation', { name: 'Main' })).toBeNull();
  });

  it('lets a page inside the frame open Settings on a section', () => {
    function Banner() {
      const open = useOpenSettings();
      return <button type="button" onClick={() => open('profile')}>Add your name</button>;
    }
    render(<AppShell me={me}><Banner /></AppShell>);
    fireEvent.click(screen.getByRole('button', { name: 'Add your name' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument();
  });
});
