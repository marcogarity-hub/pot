import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { PotState } from '@/lib/pot/chain';
import { DashboardView } from './DashboardView';
import type { ActivityItem, DashboardPot } from './dashboardModel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));

afterEach(() => cleanup());

const ME = '0x00000000000000000000000000000000000000a1';
const ORGANIZER = '0x00000000000000000000000000000000000000b2';

const pot = {
  pot_id: '7', title: 'Cabin weekend', state: PotState.Funding, receipt_hash: null,
  total: '200000000000000000000', share: '100000000000000000000',
  organizer_address: ORGANIZER, is_organizer: false,
  deadline: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  threshold: 1, objection_window_seconds: 3600, request_window_seconds: 3600,
  locked_at: null, objections_count: 0, release_eligible_at: null,
  members: [
    { address: ORGANIZER, email: 'org@example.com', has_paid: true, has_objected: false, has_refunded: false, active: true, is_organizer: true },
    { address: ME, email: 'ana@example.com', has_paid: false, has_objected: false, has_refunded: false, active: true, is_organizer: false },
  ],
} as unknown as DashboardPot;

const queue = [{
  potId: '7', potTitle: 'Cabin weekend', action: 'pay' as const, label: 'Pay your share',
  hint: '$100, closes in 3 days', href: '/pots/7', urgency: 70,
}];

const activity: ActivityItem[] = [
  { id: '2', potId: '7', potTitle: 'Cabin weekend', text: 'org@example.com paid $100', tone: 'money' },
  { id: '1', potId: '7', potTitle: 'Cabin weekend', text: 'org@example.com created this pot', tone: 'neutral' },
];

describe('DashboardView', () => {
  it('shows the signed-in email in the You section, with the account controls in the header', () => {
    render(<DashboardView email="ana@example.com" name={null} pots={[pot]} queue={queue} activity={activity} />);
    expect(document.getElementById('you')).toHaveTextContent('ana@example.com');
    const nav = screen.getByRole('navigation', { name: 'Account' });
    expect(nav).not.toHaveTextContent('ana@example.com');
    expect(within(nav).getByRole('link', { name: 'New pot' })).toHaveAttribute('href', '/new');
    expect(within(nav).getByRole('link', { name: 'You' })).toHaveAttribute('href', '#you');
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('greets by name when one is set, otherwise with Hey there', () => {
    const { unmount } = render(<DashboardView email="ana@example.com" name="Ana R." pots={[pot]} queue={queue} activity={activity} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hey Ana R.' })).toBeInTheDocument();
    expect(screen.getByText('1 trip needs you')).toBeInTheDocument();
    unmount();
    render(<DashboardView email="ana@example.com" name={null} pots={[pot]} queue={queue} activity={activity} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hey there' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Your trips' })).toBeInTheDocument();
  });

  it('offers the tab bar with Trips, Activity and You', () => {
    render(<DashboardView email="ana@example.com" name={null} pots={[]} queue={[]} activity={[]} />);
    const tabs = screen.getByRole('navigation', { name: 'Main' });
    expect(within(tabs).getByRole('link', { name: 'Trips' })).toHaveAttribute('aria-current', 'page');
    expect(within(tabs).getByRole('link', { name: 'Activity' })).toHaveAttribute('href', '#activity');
    expect(within(tabs).getByRole('link', { name: 'You' })).toHaveAttribute('href', '#you');
  });

  it('renders the held summary, the queue, the pots and the activity from the fixture', () => {
    render(<DashboardView email="ana@example.com" name={null} pots={[pot]} queue={queue} activity={activity} />);
    expect(screen.getByText('$100 held in 1 pot', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('1 needs you.')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: /needs you/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /pay your share/i })).toHaveAttribute('href', '/pots/7');

    const potsSection = document.getElementById('your-trips')?.closest('section');
    expect(potsSection).not.toBeNull();
    const potLink = within(potsSection!).getByRole('link', { name: /cabin weekend/i });
    expect(potLink).toHaveAttribute('href', '/pots/7');
    expect(within(potLink).getByText('1 of 2 paid', { exact: false })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Activity' })).toBeInTheDocument();
    expect(document.getElementById('activity')).toHaveTextContent('org@example.com paid $100');
    expect(screen.getByText('org@example.com paid $100')).toBeInTheDocument();
    expect(screen.getByText('org@example.com created this pot')).toBeInTheDocument();
  });

  it('keeps the start tiles and New pot link pointing at the create flow', () => {
    render(<DashboardView email="ana@example.com" name={null} pots={[]} queue={[]} activity={[]} />);
    expect(screen.getByRole('link', { name: /new pot/i })).toHaveAttribute('href', '/new');
    expect(screen.getByRole('link', { name: /plan a real booking/i })).toHaveAttribute('href', '/new?preset=booking');
    expect(screen.getByText('Nothing needs you right now.')).toBeInTheDocument();
    expect(screen.getByText('Payments and payouts in your pots show up here.')).toBeInTheDocument();
  });

  it('shows the name in the greeting once one is set, and no prompt', () => {
    render(<DashboardView email="ana@example.com" name="Ana R." pots={[pot]} queue={queue} activity={activity} />);
    expect(screen.getByRole('heading', { name: 'Hey Ana R.' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Account' })).not.toHaveTextContent('ana@example.com');
    expect(screen.queryByText(/can't tell who you are/i)).toBeNull();
    expect(screen.getByLabelText('Your name')).toHaveValue('Ana R.');
  });

  it('prompts for a name until one is set, linking to the name field', () => {
    render(<DashboardView email="ana@example.com" name={null} pots={[pot]} queue={queue} activity={activity} />);
    expect(screen.getByText(/can't tell who you are/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /add your name/i })).toHaveAttribute('href', '#your-name');
    expect(screen.getByLabelText('Your name')).toHaveValue('');
  });
});
