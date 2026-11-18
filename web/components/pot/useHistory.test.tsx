import { cleanup, renderHook, waitFor, act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ME = '0x00000000000000000000000000000000000000a1';
const ORG = '0x00000000000000000000000000000000000000aa';

type Result = { data: unknown; error: unknown };
let tables: Record<string, Result | (() => Result)> = {};
let inCalls: Array<[string, unknown]> = [];
let fail = false;

/** A chainable stand-in for a supabase query builder. Awaiting it resolves to the table's result. */
function builder(table: string) {
  const b: Record<string, unknown> = {};
  for (const m of ['select', 'order', 'limit', 'eq']) b[m] = () => b;
  b.in = (col: string, vals: unknown) => { inCalls.push([`${table}.${col}`, vals]); return b; };
  b.maybeSingle = () => b;
  b.then = (res: (v: Result) => unknown, rej: (e: unknown) => unknown) => {
    const t = tables[table];
    const r = typeof t === 'function' ? t() : t ?? { data: [], error: null };
    return Promise.resolve(fail ? { data: null, error: new Error('boom') } : r).then(res, rej);
  };
  return b;
}

vi.mock('@/lib/supabase/browser', () => ({
  createBrowserSupabase: () => ({ from: (table: string) => builder(table) }),
}));

import { useHistory } from './useHistory';

beforeEach(() => {
  tables = {};
  inCalls = [];
  fail = false;
});
afterEach(cleanup);

describe('useHistory', () => {
  it('starts loading, then returns the viewer\'s movements with pot titles and receipts', async () => {
    tables = {
      users: { data: { wallet_address: ME }, error: null },
      pot_events: {
        data: [
          { id: 1, pot_id: '7', event_name: 'Paid', args: { member: ME, amount: '210000000000000000000' } },
          { id: 2, pot_id: '7', event_name: 'Paid', args: { member: ORG, amount: '5' } },
        ],
        error: null,
      },
      pot_meta: { data: [{ pot_id: '7', title: 'Cabin weekend', receipt_text: null }], error: null },
    };
    const { result } = renderHook(() => useHistory());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(false);
    expect(result.current.items).toEqual([
      { id: '1', kind: 'paid', potId: '7', potTitle: 'Cabin weekend', amount: '210000000000000000000', at: null },
    ]);
    expect(inCalls).toContainEqual(['pot_meta.pot_id', ['7']]);
  });

  it('returns an empty list without a wallet and skips the events query', async () => {
    tables = { users: { data: { wallet_address: null }, error: null } };
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
    expect(result.current.error).toBe(false);
    expect(inCalls).toEqual([]);
  });

  it('reports an error and retries on request', async () => {
    fail = true;
    const { result } = renderHook(() => useHistory());
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.loading).toBe(false);

    fail = false;
    tables = { users: { data: { wallet_address: null }, error: null } };
    act(() => result.current.retry());
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe(false);
  });
});
