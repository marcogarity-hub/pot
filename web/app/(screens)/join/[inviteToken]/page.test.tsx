import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { inviteTitle, lookupInvite, potSummary } from '@/components/pot/invite.server';
import JoinPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/lib/supabase/verified-user', () => ({ getVerifiedUser: vi.fn() }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));
vi.mock('@/components/pot/invite.server', () => ({
  inviteTitle: vi.fn(),
  lookupInvite: vi.fn(),
  potSummary: vi.fn(),
}));

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

// JoinPage wraps <JoinGate /> in a Suspense boundary whose child is a promise. JoinGate is an async server
// component, which the client renderer cannot run, so the test awaits the promise and calls JoinGate directly.
async function renderJoin(token = 'tok-1') {
  const pageEl = JoinPage({
    params: Promise.resolve({ inviteToken: token }),
    searchParams: Promise.resolve({}),
  } as unknown as Parameters<typeof JoinPage>[0]) as unknown as ReactElement<{
    children: ReactElement<{ children: Promise<ReactElement> }>;
  }>;
  const gate = await pageEl.props.children.props.children;
  const resolved = await (gate.type as (p: unknown) => Promise<ReactElement>)(gate.props);
  render(resolved);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createServerSupabase).mockResolvedValue({} as unknown as Supabase);
});

afterEach(() => cleanup());

describe('JoinPage (JoinGate)', () => {
  it('asks for a sign-in code and never looks up the invite when the session is not verified', async () => {
    vi.mocked(getVerifiedUser).mockResolvedValue(null);
    vi.mocked(inviteTitle).mockResolvedValue('Cabin weekend');
    await renderJoin();
    expect(screen.getByText(/you're invited to cabin weekend/i)).toBeInTheDocument();
    expect(screen.getByText(/sign in with the email your organizer invited/i)).toBeInTheDocument();
    expect(lookupInvite).not.toHaveBeenCalled();
    expect(potSummary).not.toHaveBeenCalled();
  });

  it('looks up the invite with the verified email and shows the join preview when verified', async () => {
    vi.mocked(getVerifiedUser).mockResolvedValue({ id: 'user-1', email: 'ana@example.com' });
    vi.mocked(lookupInvite).mockResolvedValue({ potId: '7', invited: true, isOrganizer: false, memberState: 'unknown' });
    vi.mocked(potSummary).mockResolvedValue({ title: 'Cabin weekend', amount: '300', organizerEmail: 'host@example.com' });
    await renderJoin('tok-2');
    expect(lookupInvite).toHaveBeenCalledWith('tok-2', 'ana@example.com');
    expect(screen.getByRole('heading', { name: /cabin weekend/i })).toBeInTheDocument();
    expect(screen.getByText(/you'll join as/i)).toHaveTextContent('ana@example.com');
  });
});
