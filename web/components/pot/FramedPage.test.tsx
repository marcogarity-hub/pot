import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { FramedPage } from './FramedPage';

vi.mock('next/navigation', () => ({
  usePathname: () => '/history',
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
  redirect: (url: string) => { throw new Error(`REDIRECT ${url}`); },
}));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: vi.fn() }));
vi.mock('@/lib/supabase/verified-user', () => ({ getVerifiedUser: vi.fn() }));
vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));
vi.mock('./shell.server', () => ({ loadShell: vi.fn(async () => ({ me: { name: 'Ana', email: 'ana@example.com' } })) }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const page = (props: { requireSignIn?: boolean }) => FramedPage({
  path: '/history',
  ...props,
  children: <h1>History</h1>,
});

describe('FramedPage', () => {
  it('sends a signed-out visitor to sign-in with a way back when sign-in is required', async () => {
    vi.mocked(createServerSupabase).mockResolvedValue({} as never);
    vi.mocked(getVerifiedUser).mockResolvedValue(null);
    await expect(page({ requireSignIn: true })).rejects.toThrow('REDIRECT /sign-in?next=/history');
  });

  it('shows a signed-out visitor the page in a plain Screen, with a Sign in link and no sidebar', async () => {
    vi.mocked(createServerSupabase).mockResolvedValue({} as never);
    vi.mocked(getVerifiedUser).mockResolvedValue(null);
    render(await page({}));
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/sign-in');
    expect(screen.queryByRole('complementary', { name: 'Sidebar' })).toBeNull();
  });

  it('puts a signed-in visitor on the page inside the frame, with the sidebar', async () => {
    vi.mocked(createServerSupabase).mockResolvedValue({} as never);
    vi.mocked(getVerifiedUser).mockResolvedValue({ id: 'u1', email: 'ana@example.com' } as never);
    render(await page({ requireSignIn: true }));
    expect(screen.getByRole('complementary', { name: 'Sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });
});
