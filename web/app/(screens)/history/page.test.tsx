import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

// FramedPage reads the session on the server; the test only inspects the element it returns.
vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/browser', () => ({ createBrowserSupabase: vi.fn() }));
import HistoryPage from './page';

describe('HistoryPage', () => {
  it('requires sign-in and titles the page History', () => {
    // The page is a Suspense boundary around the framed content, so the test reads that element's props.
    const framed = (HistoryPage() as unknown as ReactElement<{ children: ReactElement<{ path: string; requireSignIn?: boolean; children: ReactElement<{ title: string }> }> }>).props.children;
    expect(framed.props.path).toBe('/history');
    expect(framed.props.requireSignIn).toBe(true);
    expect(framed.props.children.props.title).toBe('History');
  });
});
