import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { inviteTitle, lookupInvite, potSummary } from '@/components/pot/invite.server';
import { claimUser } from '@/lib/circle/identity';
import JoinPage from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/lib/supabase/verified-user', () => ({ getVerifiedUser: vi.fn() }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));
vi.mock('@/lib/circle/identity', () => ({ claimUser: vi.fn() }));
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
  // JoinGate reads the member's own saved name with the session client: from('users').select().eq().maybeSingle().
  const own = { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { display_name: null }, error: null }) }) }) };
  vi.mocked(createServerSupabase).mockResolvedValue({ from: () => own } as unknown as Supabase);
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
    vi.mocked(potSummary).mockResolvedValue({ title: 'Cabin weekend', amount: '300', organizerEmail: 'host@example.com', organizerName: null });
    await renderJoin('tok-2');
    expect(lookupInvite).toHaveBeenCalledWith('tok-2', 'ana@example.com');
    expect(screen.getByRole('heading', { name: /cabin weekend/i })).toBeInTheDocument();
    expect(screen.getByText(/you'll join as/i)).toHaveTextContent('ana@example.com');
  });

  describe('claiming the wallet on the pot outcome', () => {
    beforeEach(() => {
      vi.mocked(getVerifiedUser).mockResolvedValue({ id: 'user-9', email: 'ben@example.com' });
      vi.mocked(lookupInvite).mockResolvedValue({ potId: '8', invited: true, isOrganizer: false, memberState: 'unknown' });
      vi.mocked(potSummary).mockResolvedValue({ title: 'Ski trip', amount: '120', organizerEmail: 'host@example.com', organizerName: null });
      vi.mocked(claimUser).mockResolvedValue(undefined);
    });

    it('calls claimUser once with the verified id and email before the preview is rendered', async () => {
      await renderJoin('tok-3');
      expect(claimUser).toHaveBeenCalledTimes(1);
      expect(claimUser).toHaveBeenCalledWith('user-9', 'ben@example.com');
      expect(vi.mocked(claimUser).mock.invocationCallOrder[0]).toBeLessThan(
        vi.mocked(potSummary).mock.invocationCallOrder[0],
      );
      expect(screen.getByRole('heading', { name: /ski trip/i })).toBeInTheDocument();
    });

    it('does not call claimUser when there is no verified user', async () => {
      vi.mocked(getVerifiedUser).mockResolvedValue(null);
      vi.mocked(inviteTitle).mockResolvedValue('Ski trip');
      await renderJoin();
      expect(claimUser).not.toHaveBeenCalled();
    });

    it('does not call claimUser for the not-found outcome', async () => {
      vi.mocked(lookupInvite).mockResolvedValue(null);
      await renderJoin();
      expect(screen.getByRole('heading', { name: /invite not found/i })).toBeInTheDocument();
      expect(claimUser).not.toHaveBeenCalled();
    });

    it('does not call claimUser for the left outcome', async () => {
      vi.mocked(lookupInvite).mockResolvedValue({ potId: '8', invited: true, isOrganizer: false, memberState: 'inactive' });
      await renderJoin();
      expect(screen.getByRole('heading', { name: /no longer in this pot/i })).toBeInTheDocument();
      expect(claimUser).not.toHaveBeenCalled();
    });

    it('swallows a claimUser rejection and still renders the preview', async () => {
      vi.mocked(claimUser).mockRejectedValue(new Error('Identity already linked to another account'));
      vi.spyOn(console, 'error').mockImplementation(() => {});
      await renderJoin('tok-4');
      expect(screen.getByRole('heading', { name: /ski trip/i })).toBeInTheDocument();
      expect(screen.getByText(/you'll join as/i)).toHaveTextContent('ben@example.com');
    });

    it('logs only the error name, never the email, when the claim is skipped', async () => {
      const err = Object.assign(new Error('could not link ben@example.com'), { name: 'IdentityConflictError' });
      vi.mocked(claimUser).mockRejectedValue(err);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
      await renderJoin('tok-5');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('[join] claim skipped:', JSON.stringify({ name: 'IdentityConflictError' }));
      const logged = spy.mock.calls[0].map(String).join(' ');
      expect(logged).toContain('IdentityConflictError');
      expect(logged).not.toContain('ben@example.com');
      spy.mockRestore();
    });
  });
});
