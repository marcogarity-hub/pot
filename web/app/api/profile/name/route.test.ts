import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  server: vi.fn(), verified: vi.fn(), admin: vi.fn(),
  update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({ createServerSupabase: m.server }));
vi.mock('@/lib/supabase/verified-user', () => ({ getVerifiedUser: m.verified }));
vi.mock('@/lib/supabase/admin', () => ({ createAdminSupabase: m.admin }));
vi.mock('server-only', () => ({}));
import { POST } from './route';

const post = (body: unknown) => POST(new Request('http://x/api/profile/name', {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: typeof body === 'string' ? body : JSON.stringify(body),
}));
let errSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  m.server.mockResolvedValue({});
  m.verified.mockResolvedValue({ id: 'auth-id', email: 'ana@x.com' });
  m.maybeSingle.mockResolvedValue({ data: { id: 'row-1' }, error: null });
  m.select.mockReturnValue({ maybeSingle: m.maybeSingle });
  m.eq.mockReturnValue({ select: m.select });
  m.update.mockReturnValue({ eq: m.eq });
  m.admin.mockReturnValue({ from: () => ({ update: m.update }) });
});
afterEach(() => { errSpy.mockRestore(); });

it('returns 401 without a verified session and writes nothing', async () => {
  m.verified.mockResolvedValue(null);
  const response = await post({ name: 'Ana' });
  expect(response.status).toBe(401);
  expect(m.update).not.toHaveBeenCalled();
});

it('saves the cleaned name against the session user only', async () => {
  const response = await post({ name: '  Ana   R.  ' });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, name: 'Ana R.' });
  expect(m.update).toHaveBeenCalledWith({ display_name: 'Ana R.' });
  expect(m.eq).toHaveBeenCalledWith('auth_user_id', 'auth-id');
});

it('clears the name when it is blank', async () => {
  const response = await post({ name: '   ' });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ ok: true, name: null });
  expect(m.update).toHaveBeenCalledWith({ display_name: null });
});

it('ignores any other fields in the body, such as an email or id to write to', async () => {
  await post({ name: 'Ana', email: 'victim@x.com', auth_user_id: 'someone-else' });
  expect(m.update).toHaveBeenCalledWith({ display_name: 'Ana' });
  expect(m.eq).toHaveBeenCalledWith('auth_user_id', 'auth-id');
});

it('rejects an email-shaped name with 400 and a readable message', async () => {
  const response = await post({ name: 'ana@x.com' });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({ error: 'InvalidName', message: 'Use a name, not an email address.' });
  expect(m.update).not.toHaveBeenCalled();
});

it('rejects a missing name, a non-JSON body and a name that is too long', async () => {
  expect((await post({})).status).toBe(400);
  expect((await post('not json')).status).toBe(400);
  expect((await post({ name: 'a'.repeat(41) })).status).toBe(400);
  expect(m.update).not.toHaveBeenCalled();
});

it('returns 404 when the signed-in user has no account row yet', async () => {
  m.maybeSingle.mockResolvedValue({ data: null, error: null });
  const response = await post({ name: 'Ana' });
  expect(response.status).toBe(404);
  expect((await response.json()).error).toBe('NoAccount');
});

it('returns 500 with a generic message and logs no name or email when the database fails', async () => {
  m.maybeSingle.mockResolvedValue({ data: null, error: { message: 'boom ana@x.com Ana' } });
  const response = await post({ name: 'Ana' });
  expect(response.status).toBe(500);
  expect((await response.json()).error).toBe('InternalServerError');
  const logged = errSpy.mock.calls.flat().map(String).join(' ');
  expect(logged).not.toContain('ana@x.com');
  expect(logged).not.toContain('Ana');
});
