import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { authMethods, getVerifiedUser } from './verified-user';

const token = (claims: Record<string, unknown>) =>
  `${Buffer.from('{"alg":"none"}').toString('base64url')}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.sig`;

function client(opts: {
  user?: { id?: string; email?: string | null; email_confirmed_at?: string | null } | null;
  userError?: boolean;
  accessToken?: string | null;
}): SupabaseClient {
  return {
    auth: {
      getUser: async () => (opts.userError ? { data: { user: null }, error: new Error('bad') } : { data: { user: opts.user ?? null }, error: null }),
      getSession: async () => ({ data: { session: opts.accessToken ? { access_token: opts.accessToken } : null } }),
    },
  } as unknown as SupabaseClient;
}

const confirmed = { id: 'u1', email: 'a@x.com', email_confirmed_at: '2026-11-16T00:00:00Z' };

describe('authMethods', () => {
  it('reads method names from the amr claim', () => {
    expect(authMethods(token({ amr: [{ method: 'otp', timestamp: 1 }] }))).toEqual(['otp']);
    expect(authMethods(token({ amr: [{ method: 'password' }, { method: 'otp' }] }))).toEqual(['password', 'otp']);
  });
  it('returns null for missing, malformed or non-string methods', () => {
    expect(authMethods(token({}))).toBeNull();
    expect(authMethods(token({ amr: 'otp' }))).toBeNull();
    expect(authMethods(token({ amr: [{ method: 5 }] }))).toBeNull();
    expect(authMethods('not-a-jwt')).toBeNull();
    expect(authMethods('')).toBeNull();
  });
});

describe('getVerifiedUser', () => {
  it('accepts a confirmed user with a code (otp) session', async () => {
    const user = await getVerifiedUser(client({ user: confirmed, accessToken: token({ amr: [{ method: 'otp' }] }) }));
    expect(user).toEqual({ id: 'u1', email: 'a@x.com' });
  });
  it('refuses a password session, even for a confirmed email', async () => {
    expect(await getVerifiedUser(client({ user: confirmed, accessToken: token({ amr: [{ method: 'password' }] }) }))).toBeNull();
  });
  it('refuses a session that ever used a password, even alongside otp', async () => {
    expect(await getVerifiedUser(client({ user: confirmed, accessToken: token({ amr: [{ method: 'otp' }, { method: 'password' }] }) }))).toBeNull();
  });
  it('refuses anonymous sessions', async () => {
    expect(await getVerifiedUser(client({ user: confirmed, accessToken: token({ amr: [{ method: 'anonymous' }] }) }))).toBeNull();
  });
  it('refuses an unconfirmed email', async () => {
    expect(await getVerifiedUser(client({ user: { ...confirmed, email_confirmed_at: null }, accessToken: token({ amr: [{ method: 'otp' }] }) }))).toBeNull();
  });
  it('refuses when there is no user, no email, or Supabase reports an error', async () => {
    const t = token({ amr: [{ method: 'otp' }] });
    expect(await getVerifiedUser(client({ user: null, accessToken: t }))).toBeNull();
    expect(await getVerifiedUser(client({ user: { ...confirmed, email: null }, accessToken: t }))).toBeNull();
    expect(await getVerifiedUser(client({ userError: true, accessToken: t }))).toBeNull();
  });
  it('fails closed when the method list is missing, empty or unreadable, or there is no token', async () => {
    expect(await getVerifiedUser(client({ user: confirmed, accessToken: token({}) }))).toBeNull();
    expect(await getVerifiedUser(client({ user: confirmed, accessToken: token({ amr: [] }) }))).toBeNull();
    expect(await getVerifiedUser(client({ user: confirmed, accessToken: 'garbage' }))).toBeNull();
    expect(await getVerifiedUser(client({ user: confirmed, accessToken: null }))).toBeNull();
  });
});
