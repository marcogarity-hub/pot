import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AccountMenu } from './AccountMenu';

const m = vi.hoisted(() => ({ signOut: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: () => ({ auth: { signOut: m.signOut } }) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AccountMenu', () => {
  it('labels the trigger with the first word of the name, else the email', () => {
    const { unmount } = render(<AccountMenu name="Ana Rodriguez" email="ana@example.com" onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Ana' })).toBeInTheDocument();
    unmount();
    render(<AccountMenu name={null} email="ana@example.com" onOpenSettings={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'ana@example.com' })).toBeInTheDocument();
  });

  it('opens with the email as its header and the four actions', () => {
    render(<AccountMenu name="Ana" email="ana@example.com" onOpenSettings={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ana' }));
    const menu = screen.getByText('ana@example.com').closest('div, section, ul')!.parentElement!;
    expect(menu).toHaveTextContent('Settings');
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
    expect(screen.getByRole('button', { name: 'Help' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
  });

  it('Settings opens the dialog on Profile, and Help on Help', () => {
    const onOpenSettings = vi.fn();
    render(<AccountMenu name="Ana" email="ana@example.com" onOpenSettings={onOpenSettings} defaultOpen />);
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(onOpenSettings).toHaveBeenLastCalledWith('profile');
    fireEvent.click(screen.getByRole('button', { name: 'Ana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(onOpenSettings).toHaveBeenLastCalledWith('help');
  });

  it('Log out signs out and refreshes the page, as the sign-out button does', async () => {
    m.signOut.mockResolvedValue({ error: null });
    render(<AccountMenu name="Ana" email="ana@example.com" onOpenSettings={vi.fn()} defaultOpen />);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(m.refresh).toHaveBeenCalled());
    expect(m.signOut).toHaveBeenCalledWith();
  });

  it('Escape closes the menu', () => {
    render(<AccountMenu name="Ana" email="ana@example.com" onOpenSettings={vi.fn()} defaultOpen />);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Settings' }), { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
  });
});
