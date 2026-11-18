import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

// FramedPage reads the session on the server; the test only inspects the element it returns.
vi.mock('server-only', () => ({}));

vi.mock('@/components/pot/useMe', () => ({ useMe: () => ({ me: null, loading: true, retry: vi.fn() }) }));
import WalletPage from './page';

describe('WalletPage', () => {
  it('requires sign-in and titles the page Wallet', () => {
    const framed = (WalletPage() as unknown as ReactElement<{ children: ReactElement<{ path: string; requireSignIn?: boolean; children: ReactElement<{ title: string }> }> }>).props.children;
    expect(framed.props.path).toBe('/wallet');
    expect(framed.props.requireSignIn).toBe(true);
    expect(framed.props.children.props.title).toBe('Wallet');
  });
});
