import { beforeEach, describe, expect, it, vi } from 'vitest';
import { initialFromPot, runAgainInitial, type RunAgainRow } from './runAgain.server';

vi.mock('server-only', () => ({}));

const select = vi.hoisted(() => ({ result: null as unknown, calls: [] as Array<[string, unknown]>, throws: false }));
vi.mock('@/lib/supabase/server', () => ({
  createServerSupabase: async () => {
    if (select.throws) throw new Error('boom');
    return {
      from(table: string) {
        const builder = {
          select: (cols: string) => { select.calls.push(['select', `${table}:${cols}`]); return builder; },
          eq: (col: string, val: unknown) => { select.calls.push(['eq', `${col}=${val}`]); return builder; },
          maybeSingle: async () => ({ data: select.result, error: null }),
        };
        return builder;
      },
    };
  },
}));

const ROW: RunAgainRow = {
  title: 'Cabin',
  total: '200000000000000000000', // 200 USDC in 18-decimal base units
  threshold: 2,
  objection_window_seconds: 172800,
  request_window_seconds: 604800,
  is_organizer: true,
  members: [
    { email: 'a@example.com', active: true },
    { email: null, active: true },
    { email: 'old@example.com', active: false },
    { email: 'b@example.com', active: true },
    { email: 'a@example.com', active: true },
  ],
};

beforeEach(() => {
  select.result = ROW;
  select.calls = [];
  select.throws = false;
});

describe('initialFromPot', () => {
  it('maps title, total, visible active emails, threshold and windows', () => {
    expect(initialFromPot(ROW)).toEqual({
      title: 'Cabin',
      total: '200',
      members: ['a@example.com', 'b@example.com'],
      threshold: 2,
      objectionWindow: 172800,
      requestWindow: 604800,
    });
  });

  it('keeps fractional totals and an empty title as an empty string', () => {
    const out = initialFromPot({ ...ROW, title: null, total: '12500000000000000000' });
    expect(out.total).toBe('12.5');
    expect(out.title).toBe('');
  });
});

describe('runAgainInitial', () => {
  it('returns the initial values for the organizer', async () => {
    const out = await runAgainInitial('42');
    expect(out).toMatchObject({ title: 'Cabin', total: '200', threshold: 2 });
    expect(select.calls).toContainEqual(['eq', 'pot_id=42']);
  });

  it('returns null for someone who is not the organizer', async () => {
    select.result = { ...ROW, is_organizer: false };
    expect(await runAgainInitial('42')).toBeNull();
  });

  it('returns null when the pot is not visible', async () => {
    select.result = null;
    expect(await runAgainInitial('42')).toBeNull();
  });

  it('returns null without querying for a value that is not a pot id', async () => {
    expect(await runAgainInitial("1' or '1'='1")).toBeNull();
    expect(await runAgainInitial('')).toBeNull();
    expect(select.calls).toEqual([]);
  });

  it('returns null when the read throws', async () => {
    select.throws = true;
    expect(await runAgainInitial('42')).toBeNull();
  });
});
