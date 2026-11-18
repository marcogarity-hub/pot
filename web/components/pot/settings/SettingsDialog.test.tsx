import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { SettingsDialog } from './SettingsDialog';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/components/pot/useMe', () => ({ useMe: () => ({ me: null, loading: true, retry: vi.fn() }) }));

const me = { name: 'Ana', email: 'ana@example.com' };

afterEach(() => cleanup());

describe('SettingsDialog', () => {
  it('lists the two sections and opens on Profile by default', () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} me={me} />);
    const nav = screen.getByRole('navigation', { name: 'Settings sections' });
    expect(within(nav).getAllByRole('button').map(b => b.textContent)).toEqual(['Profile', 'Privacy']);
    expect(within(nav).getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Profile' })).toBeInTheDocument();
  });

  it('opens on the section it is given', () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} section="privacy" me={me} />);
    expect(screen.getByRole('heading', { level: 2, name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privacy' })).toHaveAttribute('aria-current', 'true');
  });

  it('puts the log-out-everywhere block under the profile fields', () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} me={me} />);
    expect(screen.getByLabelText('Your name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out of all devices' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Wallet' })).toHaveAttribute('href', '/wallet');
  });

  it('switches sections on click', () => {
    render(<SettingsDialog open onOpenChange={vi.fn()} me={me} />);
    fireEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Privacy' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Privacy' })).toHaveAttribute('aria-current', 'true');
  });

  it('closes from the close button and from Escape', () => {
    const onOpenChange = vi.fn();
    render(<SettingsDialog open onOpenChange={onOpenChange} me={me} />);
    fireEvent.click(screen.getByRole('button', { name: 'Close settings' }));
    expect(onOpenChange.mock.calls[0][0]).toBe(false);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onOpenChange).toHaveBeenCalledTimes(2);
    expect(onOpenChange.mock.calls[1][0]).toBe(false);
  });

  it('renders nothing while closed', () => {
    render(<SettingsDialog open={false} onOpenChange={vi.fn()} me={me} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
