import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadShell } from './shell.server';

vi.mock('server-only', () => ({}));

/** A Supabase stand-in that answers the one users query loadShell makes and records every table it touches. */
function fakeSupabase(row: { display_name: string | null } | null) {
  const from = vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({ maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }) })),
    })),
  }));
  return { supabase: { from } as unknown as SupabaseClient, from };
}

describe('loadShell', () => {
  it('returns the display name and the verified email with a single users query', async () => {
    const { supabase, from } = fakeSupabase({ display_name: 'Ana R.' });
    const shell = await loadShell(supabase, { id: 'user-1', email: 'ana@example.com' });
    expect(shell).toEqual({ me: { name: 'Ana R.', email: 'ana@example.com' } });
    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith('users');
  });

  it('has a null name when the user has no row or no display name', async () => {
    expect((await loadShell(fakeSupabase(null).supabase, { id: 'u', email: 'a@example.com' })).me.name).toBeNull();
    expect((await loadShell(fakeSupabase({ display_name: null }).supabase, { id: 'u', email: 'a@example.com' })).me.name).toBeNull();
  });
});
