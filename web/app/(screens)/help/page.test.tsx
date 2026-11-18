import { describe, expect, it, vi } from 'vitest';
import type { ReactElement } from 'react';

// FramedPage reads the session on the server; the test only inspects the element it returns.
vi.mock('server-only', () => ({}));
import HelpPage from './page';

describe('HelpPage', () => {
  it('is public: it does not require sign-in, and titles the page Help', () => {
    const framed = (HelpPage() as unknown as ReactElement<{ children: ReactElement<{ path: string; requireSignIn?: boolean; children: ReactElement<{ title: string }> }> }>).props.children;
    expect(framed.props.path).toBe('/help');
    expect(framed.props.requireSignIn).toBeUndefined();
    expect(framed.props.children.props.title).toBe('Help');
  });
});
