import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PotState } from '@/lib/pot/chain';
import { DashboardView } from './DashboardView';
import type { DashboardPot } from './dashboardModel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));
vi.mock('./useHistory', () => ({ useHistory: () => ({ items: [], loading: false, error: false, retry: vi.fn() }) }));

afterEach(() => cleanup());

const ME = '0x00000000000000000000000000000000000000a1';
const ORGANIZER = '0x00000000000000000000000000000000000000b2';
const NOW = Date.now();

const pot = {
  pot_id: '7', title: 'Cabin weekend', state: PotState.Funding, receipt_hash: null,
  total: '200000000000000000000', share: '100000000000000000000',
  organizer_address: ORGANIZER, is_organizer: false,
  deadline: new Date(NOW + 3 * 86_400_000).toISOString(),
  threshold: 1, objection_window_seconds: 3600, request_window_seconds: 3600,
  locked_at: null, objections_count: 0, release_eligible_at: null,
  members: [
    { address: ORGANIZER, email: 'org@example.com', name: null, has_paid: true, has_objected: false, has_refunded: false, active: true, is_organizer: true },
    { address: ME, email: 'ana@example.com', name: null, has_paid: false, has_objected: false, has_refunded: false, active: true, is_organizer: false },
  ],
} as unknown as DashboardPot;

const queue = [{
  potId: '7', potTitle: 'Cabin weekend', action: 'pay' as const, label: 'Pay your share',
  hint: '$100, closes in 3 days', href: '/pots/7', urgency: 70,
}];

describe('DashboardView', () => {
  it('greets by first name when one is set, and says how many trips need the viewer', () => {
    render(<DashboardView name="Ana R." pots={[pot]} queue={queue} now={NOW} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hey Ana' })).toBeInTheDocument();
    expect(screen.getByText('1 needs you')).toBeInTheDocument();
  });

  it('greets with Hey there and no name prompt when no name is set and nothing needs the viewer', () => {
    render(<DashboardView name={null} pots={[]} queue={[]} now={NOW} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hey there' })).toBeInTheDocument();
    expect(screen.getByText('Nothing needs you right now')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Add your name' })).toBeInTheDocument();
  });

  it('shows the name prompt only until a name is set', () => {
    const { unmount } = render(<DashboardView name={null} pots={[pot]} queue={queue} now={NOW} />);
    expect(screen.getByRole('button', { name: 'Add your name' })).toBeInTheDocument();
    unmount();
    render(<DashboardView name="Ana R." pots={[pot]} queue={queue} now={NOW} />);
    expect(screen.queryByRole('region', { name: 'Add your name' })).toBeNull();
  });

  it('renders the held summary, the needs-you card, the trips, quick start and history', () => {
    render(<DashboardView name="Ana R." pots={[pot]} queue={queue} now={NOW} />);
    expect(screen.getAllByText('$100').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/held across 1 pot/)).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pay your share/i })).toHaveAttribute('href', '/pots/7');

    const trips = document.getElementById('your-pots')!;
    expect(within(trips).getByRole('heading', { name: 'Your trips' })).toBeInTheDocument();
    const potLink = within(trips).getByRole('link', { name: /cabin weekend/i });
    expect(potLink).toHaveAttribute('href', '/pots/7');
    expect(within(potLink).getByText('1 of 2 paid', { exact: false })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Start something new' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
  });

  it('lists the pots closing within a week under Closing soon', () => {
    render(<DashboardView name="Ana R." pots={[pot]} queue={queue} now={NOW} />);
    const closing = screen.getByRole('heading', { name: 'Closing soon' }).closest('section')!;
    expect(within(closing).getByRole('link', { name: /cabin weekend/i })).toHaveAttribute('href', '/pots/7');
  });

  it('has no Activity section and no pot-event feed', () => {
    render(<DashboardView name="Ana R." pots={[pot]} queue={queue} now={NOW} />);
    expect(screen.queryByRole('heading', { name: 'Activity' })).toBeNull();
    expect(screen.queryByText(/created this pot|paid \$/)).toBeNull();
  });

  it('keeps the start actions pointing at the create flow', () => {
    render(<DashboardView name="Ana R." pots={[]} queue={[]} now={NOW} />);
    expect(screen.getByRole('link', { name: 'Start a pot' })).toHaveAttribute('href', '/new');
    expect(screen.getByRole('link', { name: 'Plan a real booking' })).toHaveAttribute('href', '/new?preset=booking');
  });

  it('shows the test-money note and the privacy link in the footer', () => {
    render(<DashboardView name="Ana R." pots={[]} queue={[]} now={NOW} />);
    expect(screen.getByText('Test money only: USDC on the Arc testnet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy' })).toHaveAttribute('href', '/privacy');
  });
});
