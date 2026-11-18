import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  it('opens with the email as its header and exactly three actions: Profile, Privacy, Log out', () => {
    render(<AccountMenu name="Ana" email="ana@example.com" onOpenSettings={vi.fn()} defaultOpen />);
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    const menu = screen.getByRole('button', { name: 'Log out' }).closest('ul') as HTMLElement;
    expect(within(menu).getAllByRole('button').map(b => b.textContent)).toEqual(['Profile', 'Privacy', 'Log out']);
    expect(screen.queryByRole('button', { name: 'Settings' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Help' })).toBeNull();
  });

  it('Profile and Privacy open the dialog on their own section', () => {
    const onOpenSettings = vi.fn();
    render(<AccountMenu name="Ana" email="ana@example.com" onOpenSettings={onOpenSettings} defaultOpen />);
    fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
    expect(onOpenSettings).toHaveBeenLastCalledWith('profile');
    fireEvent.click(screen.getByRole('button', { name: 'Ana' }));
    fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    expect(onOpenSettings).toHaveBeenLastCalledWith('privacy');
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
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Profile' }), { key: 'Escape' });
    expect(screen.queryByRole('button', { name: 'Profile' })).toBeNull();
  });
});
