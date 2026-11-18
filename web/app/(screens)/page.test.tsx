import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import Home from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/',
}));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/lib/supabase/verified-user', () => ({ getVerifiedUser: vi.fn() }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));
vi.mock('@/components/pot/useMe', () => ({ useMe: () => ({ me: null, loading: true, retry: vi.fn() }) }));
vi.mock('@/components/pot/useHistory', () => ({ useHistory: () => ({ items: [], loading: false, error: false, retry: vi.fn() }) }));

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

const ME = '0x00000000000000000000000000000000000000a1';
const ORGANIZER = '0x00000000000000000000000000000000000000b2';

// Home returns <Suspense fallback><HomeContent /></Suspense>. HomeContent is an async server component,
// which the client renderer cannot run, so the test takes that child element and calls it directly.
async function renderHome() {
  const suspense = Home() as unknown as ReactElement<{ children: ReactElement<Record<string, unknown>> }>;
  const content = suspense.props.children;
  const resolved = await (content.type as (p: unknown) => Promise<ReactElement>)(content.props);
  render(resolved);
}

// A pot the viewer is in and has not paid yet, so the queue shows a "Pay your share" action.
const openPot = {
  pot_id: '7',
  title: 'Cabin weekend',
  state: 0,
  receipt_hash: null,
  total: '200000000000000000000',
  share: '100000000000000000000',
  organizer_address: ORGANIZER,
  is_organizer: false,
  deadline: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  threshold: 1,
  objection_window_seconds: 3600,
  request_window_seconds: 3600,
  locked_at: null,
  objections_count: 0,
  release_eligible_at: null,
  members: [
    { address: ORGANIZER, email: 'org@example.com', has_paid: true, has_objected: false, has_refunded: false, active: true, is_organizer: true },
    { address: ME, email: 'ana@example.com', has_paid: false, has_objected: false, has_refunded: false, active: true, is_organizer: false },
  ],
};

let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  // Each table answers the query shape page.tsx uses for it.
  from = vi.fn((table: string) => {
    if (table === 'pot_status') {
      return { select: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [openPot] }) })) };
    }
    if (table === 'users') {
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: { wallet_address: ME } }) })),
        })),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  vi.mocked(createServerSupabase).mockResolvedValue({ from } as unknown as Supabase);
});

afterEach(() => cleanup());

describe('Home (HomeContent)', () => {
  it('shows the signed-out view and makes no pot query when the session is not verified', async () => {
    vi.mocked(getVerifiedUser).mockResolvedValue(null);
    await renderHome();
    expect(screen.getByRole('link', { name: /start a plan/i })).toHaveAttribute('href', '/sign-in?next=/new');
    expect(screen.getByRole('link', { name: /try the demo/i })).toHaveAttribute('href', '/demo');
    for (const link of screen.getAllByRole('link', { name: /^sign in$/i })) {
      expect(link).toHaveAttribute('href', '/sign-in');
    }
    expect(from).not.toHaveBeenCalled();
  });

  it('loads the pots and renders the dashboard inside the signed-in shell', async () => {
    vi.mocked(getVerifiedUser).mockResolvedValue({ id: 'user-1', email: 'ana@example.com' });
    await renderHome();
    // AppShell: the sidebar and the tab bar are present around the dashboard.
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    expect(screen.getByText(/held across \d+ plans?/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /needs you/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your plans/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /start a plan/i })).toHaveAttribute('href', '/new');
    expect(screen.getAllByText('Cabin weekend').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Pay your share')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Activity' })).toBeNull();
    expect(from).toHaveBeenCalledWith('pot_status');
    expect(from).toHaveBeenCalledWith('users');
    expect(from).not.toHaveBeenCalledWith('pot_events');
  });
});

describe('Home signed-out example', () => {
  it('shows the example pot strip and one sign-in action that goes to the sign-in page', async () => {
    vi.mocked(getVerifiedUser).mockResolvedValue(null);
    await renderHome();
    expect(screen.getByRole('img', { name: '3 of 4 paid' })).toBeInTheDocument();
    for (const link of screen.getAllByRole('link', { name: /^sign in$/i })) {
      expect(link).toHaveAttribute('href', '/sign-in');
    }
  });
});
