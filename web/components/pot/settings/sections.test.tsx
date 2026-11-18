import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ProfileSection } from './ProfileSection';
import { WalletSection } from './WalletSection';
import { SecuritySection } from './SecuritySection';
import { PrivacySection } from './PrivacySection';

const m = vi.hoisted(() => ({ me: null as unknown, retry: vi.fn(), signOut: vi.fn(), refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: m.refresh, push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/components/pot/useMe', () => ({ useMe: () => ({ me: m.me, loading: m.me === null, retry: m.retry }) }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: () => ({ auth: { signOut: m.signOut } }) }));

const ADDRESS = '0x00000000000000000000000000000000000000a1';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  m.me = null;
});

describe('ProfileSection', () => {
  it('shows the saved name in the field and the email read only', () => {
    render(<ProfileSection name="Ana" email="ana@example.com" />);
    expect(screen.getByLabelText('Your name')).toHaveValue('Ana');
    expect(screen.getByLabelText('Email')).toHaveValue('ana@example.com');
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    expect(screen.getByText('Friends in your pots see this name.')).toBeInTheDocument();
  });
});

describe('WalletSection', () => {
  it('shows the address with a copy button that confirms the copy', async () => {
    m.me = { kind: 'ready', email: 'ana@example.com', wallet_address: ADDRESS };
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    render(<WalletSection />);
    expect(screen.getByText(ADDRESS)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy address' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument());
    expect(writeText).toHaveBeenCalledWith(ADDRESS);
    expect(screen.getByText('Your money is held in USDC on Arc.')).toBeInTheDocument();
    expect(screen.getByText('This is test money, not real dollars.')).toBeInTheDocument();
  });

  it('says calmly when no wallet exists yet', () => {
    m.me = { kind: 'no-wallet', email: 'ana@example.com' };
    render(<WalletSection />);
    expect(screen.getByText('Your wallet is set up the first time you join or start a pot.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Copy address' })).toBeNull();
  });

  it('offers a retry when the wallet cannot be loaded', () => {
    m.me = { kind: 'error' };
    render(<WalletSection />);
    expect(screen.getByRole('alert')).toHaveTextContent('We could not load your wallet.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(m.retry).toHaveBeenCalled();
  });
});

describe('SecuritySection', () => {
  it('asks before logging out everywhere, then signs out globally and goes home', async () => {
    m.signOut.mockResolvedValue({ error: null });
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    render(<SecuritySection />);
    fireEvent.click(screen.getByRole('button', { name: 'Log out of all devices' }));
    expect(m.signOut).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Log out everywhere' }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith('/'));
    expect(m.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });

  it('cancel returns without signing out', () => {
    render(<SecuritySection />);
    fireEvent.click(screen.getByRole('button', { name: 'Log out of all devices' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('button', { name: 'Log out of all devices' })).toBeInTheDocument();
    expect(m.signOut).not.toHaveBeenCalled();
  });

  it('shows an alert when sign-out fails', async () => {
    m.signOut.mockResolvedValue({ error: new Error('down') });
    render(<SecuritySection />);
    fireEvent.click(screen.getByRole('button', { name: 'Log out of all devices' }));
    fireEvent.click(screen.getByRole('button', { name: 'Log out everywhere' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('We could not log you out everywhere.');
  });
});

describe('PrivacySection', () => {
  it('states who sees what and links to the full notice', () => {
    render(<PrivacySection />);
    expect(screen.getByText(/never your email address/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read the full privacy notice' })).toHaveAttribute('href', '/privacy');
  });
});
