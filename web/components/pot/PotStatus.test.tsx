import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PotStatusRow } from '@/lib/realtime/usePot';
import { usePot } from '@/lib/realtime/usePot';
import { useMe } from './useMe';
import type { MeState } from './meState';
import { PotStatus } from './PotStatus';

vi.mock('@/lib/realtime/usePot', () => ({ usePot: vi.fn() }));
vi.mock('./useMe', () => ({ useMe: vi.fn() }));
vi.mock('./autoFinalize', () => ({ useAutoFinalize: vi.fn() }));

const ME_ADDRESS = '0x00000000000000000000000000000000000000a1';
const ORG = '0x00000000000000000000000000000000000000aa';
const FUTURE = '2999-01-01T00:00:00.000Z';

const status: PotStatusRow = {
  pot_id: '1', organizer_address: ORG, total: '200000000000000000000', share: '100000000000000000000',
  deadline: FUTURE, threshold: 1, objection_window_seconds: 120, request_window_seconds: 120,
  locked_at: null, state: 0, payments_count: 0, objections_count: 0, receipt_hash: null,
  release_eligible_at: null, updated_at: FUTURE, title: 'Trip', invite_token: 'tok',
  receipt_text: null, created_at: FUTURE, is_organizer: null,
  members: [
    { address: ME_ADDRESS, email: 'a@example.com', name: null, has_paid: false, has_objected: false, has_refunded: false, active: true, is_organizer: false },
    { address: ORG, email: null, name: null, has_paid: false, has_objected: false, has_refunded: false, active: true, is_organizer: true },
  ],
};

function mockPot(s: PotStatusRow | null) {
  vi.mocked(usePot).mockReturnValue({ status: s, loading: false, refetch: vi.fn().mockResolvedValue(undefined) });
}

function mockMe(me: MeState | null, retry = vi.fn()) {
  vi.mocked(useMe).mockReturnValue({ me, loading: me === null, retry });
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => cleanup());

describe('PotStatus by identity state', () => {
  it('ready: the viewer gets the actions their state allows (pay before the deadline)', () => {
    mockPot(status);
    mockMe({ kind: 'ready', email: 'a@example.com', wallet_address: ME_ADDRESS });
    render(<PotStatus potId="1" />);
    expect(screen.getByRole('button', { name: /pay 100 usdc/i })).toBeTruthy();
    expect(screen.queryByText(/not part of this pot yet/i)).toBeNull();
  });

  it('no-wallet with the pot visible: explains the state and offers no actions or sign-in', () => {
    mockPot(status);
    mockMe({ kind: 'no-wallet' });
    render(<PotStatus potId="1" />);
    expect(screen.getByText("You're signed in but not part of this pot yet.")).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull();
  });

  it('no-wallet with no pot found: explains the state, no sign-in prompt', () => {
    mockPot(null);
    mockMe({ kind: 'no-wallet' });
    render(<PotStatus potId="1" />);
    expect(screen.getByText("You're signed in but not part of this pot yet.")).toBeTruthy();
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('error: shows a retry message, not a sign-in button, and retry re-requests the state', () => {
    const retry = vi.fn();
    mockPot(status);
    mockMe({ kind: 'error' }, retry);
    render(<PotStatus potId="1" />);
    expect(screen.getByText(/couldn.t check your account/i)).toBeTruthy();
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /pay/i })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('error with no pot found: still shows the retry message, never sign-in', () => {
    mockPot(null);
    mockMe({ kind: 'error' });
    render(<PotStatus potId="1" />);
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
    expect(screen.queryByRole('link', { name: /sign in/i })).toBeNull();
  });

  it('signed-out with no pot found: offers sign-in', () => {
    mockPot(null);
    mockMe({ kind: 'signed-out' });
    render(<PotStatus potId="1" />);
    expect(screen.getByRole('link', { name: /sign in/i })).toBeTruthy();
  });

  it('signed-out with the pot visible: no actions, offers sign-in', () => {
    mockPot(status);
    mockMe({ kind: 'signed-out' });
    render(<PotStatus potId="1" />);
    expect(screen.queryByRole('button', { name: /pay/i })).toBeNull();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeTruthy();
  });
});

describe('PotStatus session expiry (UI-01)', () => {
  it('a 401 from an action re-checks the identity, and the signed-out state shows the sign-in link and no actions', async () => {
    const retry = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })));
    mockPot(status);
    mockMe({ kind: 'ready', email: 'a@example.com', wallet_address: ME_ADDRESS }, retry);
    const { rerender } = render(<PotStatus potId="1" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /pay 100 usdc/i })); });
    expect(screen.getByRole('alert')).toHaveTextContent('Please sign in again.');
    expect(retry).toHaveBeenCalledTimes(1);

    // retry() makes useMe report the session as gone.
    mockMe({ kind: 'signed-out' }, retry);
    rerender(<PotStatus potId="1" />);
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/sign-in?next=/pots/1');
    expect(screen.queryByRole('button', { name: /pay/i })).toBeNull();
    vi.unstubAllGlobals();
  });
});
