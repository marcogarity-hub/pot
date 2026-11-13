import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lookupInvite } from './invite.server';
import { resolveInvite } from './auth';

type Row = Record<string, unknown>;
let tables: Record<string, Row[]> = {};

vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminSupabase: () => ({
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const builder = {
        select: () => builder,
        eq(column: string, value: unknown) { filters.push([column, value]); return builder; },
        limit: () => builder,
        maybeSingle: async () => {
          const row = (tables[table] ?? []).find(r => filters.every(([c, v]) => String(r[c]) === String(v)));
          return { data: row ?? null, error: null };
        },
      };
      return builder;
    },
  }),
}));

const POT = { pot_id: '9', organizer_address: '0xorg' };
const TOKEN_ROW = { pot_id: '9', invite_token: 'tok' };

beforeEach(() => {
  tables = {
    pot_meta: [TOKEN_ROW],
    pots: [POT],
    pot_invites: [{ pot_id: '9', address: '0xalice', email: 'alice@example.com' }, { pot_id: '9', address: '0xbob', email: 'bob@example.com' }],
    pot_members: [
      { pot_id: '9', address: '0xalice', active: true },
      { pot_id: '9', address: '0xbob', active: false }, // swapped out
    ],
    users: [
      { email: 'alice@example.com', wallet_address: '0xalice' },
      { email: 'bob@example.com', wallet_address: '0xbob' },
      { email: 'org@example.com', wallet_address: '0xorg' },
    ],
  };
});

describe('lookupInvite', () => {
  it('reports an active invited member as an active member', async () => {
    const lookup = await lookupInvite('tok', 'alice@example.com');
    expect(lookup).toEqual({ potId: '9', invited: true, isOrganizer: false, isActiveMember: true });
    expect(resolveInvite(lookup)).toEqual({ kind: 'pot', potId: '9' });
  });

  it('does not treat a swapped-out member as an active member', async () => {
    const lookup = await lookupInvite('tok', 'bob@example.com');
    expect(lookup).toMatchObject({ invited: true, isActiveMember: false });
    expect(resolveInvite(lookup)).toEqual({ kind: 'left' });
  });

  it('still lets the organizer in', async () => {
    const lookup = await lookupInvite('tok', 'org@example.com');
    expect(resolveInvite(lookup)).toEqual({ kind: 'pot', potId: '9' });
  });

  it('returns not-invited for an email with no invite row', async () => {
    const lookup = await lookupInvite('tok', 'mallory@example.com');
    expect(resolveInvite(lookup)).toEqual({ kind: 'not-invited' });
  });

  it('returns null for an unknown token', async () => {
    expect(await lookupInvite('nope', 'alice@example.com')).toBeNull();
  });
});
