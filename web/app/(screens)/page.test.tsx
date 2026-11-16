import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import Home from './page';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/lib/supabase/verified-user', () => ({ getVerifiedUser: vi.fn() }));

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;

// Home renders <Screen><Suspense><HomeContent /></Suspense></Screen>. HomeContent is an async server
// component, which the client renderer cannot run, so the test resolves it by calling it directly.
async function renderHome() {
  const screenEl = Home() as unknown as ReactElement<{ children: ReactElement<{ children: ReactElement }> }>;
  const content = screenEl.props.children.props.children;
  const resolved = await (content.type as (p: unknown) => Promise<ReactElement>)(content.props);
  render(resolved);
}

let from: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  const order = vi.fn().mockResolvedValue({ data: [] });
  const select = vi.fn(() => ({ order }));
  from = vi.fn(() => ({ select }));
  vi.mocked(createServerSupabase).mockResolvedValue({ from } as unknown as Supabase);
});

afterEach(() => cleanup());

describe('Home (HomeContent)', () => {
  it('shows the signed-out view and makes no pot query when the session is not verified', async () => {
    vi.mocked(getVerifiedUser).mockResolvedValue(null);
    await renderHome();
    expect(screen.getByRole('link', { name: /start a pot/i })).toHaveAttribute('href', '/sign-in?next=/new');
    expect(screen.getByRole('link', { name: /^sign in$/i })).toHaveAttribute('href', '/sign-in');
    expect(from).not.toHaveBeenCalled();
  });

  it('loads the pots and shows the verified email when the session is verified', async () => {
    vi.mocked(getVerifiedUser).mockResolvedValue({ id: 'user-1', email: 'ana@example.com' });
    await renderHome();
    expect(screen.getByRole('heading', { name: /your pots/i })).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(from).toHaveBeenCalledWith('pot_status');
  });
});
