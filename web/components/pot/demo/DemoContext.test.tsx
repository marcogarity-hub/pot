import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import { useHistory } from '../useHistory';
import { useMe } from '../useMe';
import { AppLink, DemoProvider, demoPath, useDemo, type DemoContextValue } from './DemoContext';

afterEach(cleanup);

const value: DemoContextValue = {
  history: [{ id: 'h1', kind: 'paid', potId: 'lake-house', potTitle: 'Lake house, August', amount: '600000000000000000000', at: null }],
  wallet: '0x00000000000000000000000000000000000a11ce',
  email: 'alex@example.com',
};

describe('demoPath', () => {
  it.each([
    ['/', '/demo'],
    ['/pots/lake-house', '/demo/pots/lake-house'],
    ['/history', '/demo/history'],
    ['/wallet', '/demo/wallet'],
    ['/help', '/demo/help'],
    ['/new', '/demo/new'],
    ['/new?template=trip', '/demo/new'],
    ['/new?from=lake-house', '/demo/new'],
    ['/new?preset=booking', '/demo/new'],
    ['#your-pots', '#your-pots'],
    ['/privacy', '/privacy'],
    ['/sign-in?next=/new', '/sign-in?next=/new'],
  ])('%s -> %s', (from, to) => {
    expect(demoPath(from)).toBe(to);
  });
});

describe('AppLink', () => {
  it('is a plain link in the real app', () => {
    render(<AppLink href="/history">History</AppLink>);
    expect(screen.getByRole('link', { name: 'History' })).toHaveAttribute('href', '/history');
  });

  it('stays inside the demo', () => {
    render(<DemoProvider value={value}><AppLink href="/pots/lake-house">Lake</AppLink></DemoProvider>);
    expect(screen.getByRole('link', { name: 'Lake' })).toHaveAttribute('href', '/demo/pots/lake-house');
  });
});

describe('demo hooks', () => {
  it('useDemo is null outside the demo', () => {
    expect(renderHook(() => useDemo()).result.current).toBeNull();
  });

  it('useHistory returns the sample list at once, without a request', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useHistory(), { wrapper: ({ children }) => <DemoProvider value={value}>{children}</DemoProvider> });
    expect(result.current).toMatchObject({ loading: false, error: false, items: value.history });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('useMe returns the demo wallet as ready, without a request', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const { result } = renderHook(() => useMe(), { wrapper: ({ children }) => <DemoProvider value={value}>{children}</DemoProvider> });
    expect(result.current.loading).toBe(false);
    expect(result.current.me).toEqual({ kind: 'ready', email: 'alex@example.com', wallet_address: value.wallet });
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
