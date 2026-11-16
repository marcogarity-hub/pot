import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({server:vi.fn(),claimUser:vi.fn(),exchange:vi.fn(),verified:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createServerSupabase:m.server}));
vi.mock('@/lib/circle/identity',()=>({claimUser:m.claimUser}));
vi.mock('@/lib/supabase/verified-user',()=>({getVerifiedUser:m.verified}));
vi.mock('server-only',()=>({}));
import { GET } from './route';
const origin='https://pot.test';
const get=(qs:string)=>GET(new Request(`${origin}/api/wallet/callback${qs}`));
const expired='/sign-in?error=link';
let errSpy: ReturnType<typeof vi.spyOn>;
const logged=()=>errSpy.mock.calls.flat().map(String).join(' ');
beforeEach(()=>{
 vi.clearAllMocks();
 errSpy=vi.spyOn(console,'error').mockImplementation(()=>{});
 m.server.mockResolvedValue({auth:{exchangeCodeForSession:m.exchange}});
 m.exchange.mockResolvedValue({error:null});
 m.verified.mockResolvedValue({id:'auth-id',email:'a@x.com'});
 m.claimUser.mockResolvedValue(undefined);
});
afterEach(()=>{errSpy.mockRestore();});

it('redirects to /sign-in?error=link when there is no code',async()=>{
 const response=await get('');
 expect(response.status).toBe(302);
 expect(response.headers.get('location')).toBe(`${origin}${expired}`);
 expect(m.exchange).not.toHaveBeenCalled();
 expect(errSpy).toHaveBeenCalledWith('[api/wallet/callback] sign-in failed:',JSON.stringify({reason:'missing_code',supabaseCode:null}));
});

it('redirects an expired link (error_code=otp_expired, no code) to /sign-in?error=link',async()=>{
 const response=await get('?error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
 expect(response.status).toBe(302);
 expect(response.headers.get('location')).toBe(`${origin}${expired}`);
 expect(m.exchange).not.toHaveBeenCalled();
 expect(errSpy).toHaveBeenCalledWith('[api/wallet/callback] sign-in failed:',JSON.stringify({reason:'provider_error',supabaseCode:'otp_expired',detail:'Email link is invalid or has expired'}));
});

it('logs a masked reason for a failed provider exchange: no emails, no long tokens, cut to 160 characters',async()=>{
 const token='4/0AeaYSHDoNotLogThisOneTimeCodeAbcdef0123456789';
 await get(`?error=server_error&error_code=unexpected_failure&error_description=${encodeURIComponent(`Unable to exchange external code: ${token} for ada@example.com`)}`);
 expect(errSpy).toHaveBeenCalledWith('[api/wallet/callback] sign-in failed:',JSON.stringify({reason:'provider_error',supabaseCode:'unexpected_failure',detail:'Unable to exchange external code: [x] for [email]'}));
 expect(logged()).not.toContain('DoNotLogThisOneTimeCode');
 expect(logged()).not.toContain('ada@example.com');
 errSpy.mockClear();
 await get(`?error=server_error&error_description=${'word '.repeat(80)}`);
 const detail=JSON.parse(String(errSpy.mock.calls[0][1])).detail as string;
 expect(detail.length).toBeLessThanOrEqual(160);
});

it('treats error_description alone as a provider error',async()=>{
 const response=await get('?error_description=oops');
 expect(response.headers.get('location')).toBe(`${origin}${expired}`);
 expect(errSpy).toHaveBeenCalledWith('[api/wallet/callback] sign-in failed:',JSON.stringify({reason:'provider_error',supabaseCode:null,detail:'oops'}));
});

it('keeps a valid next target on the failure redirect',async()=>{
 const response=await get('?error_code=otp_expired&next=/join/abc');
 expect(response.status).toBe(302);
 expect(response.headers.get('location')).toBe(`${origin}/sign-in?error=link&next=%2Fjoin%2Fabc`);
});

it('keeps a valid next target when there is no code',async()=>{
 const response=await get('?next=/join/abc');
 expect(response.headers.get('location')).toBe(`${origin}/sign-in?error=link&next=%2Fjoin%2Fabc`);
});

it('drops a protocol-relative next target on the failure redirect',async()=>{
 const response=await get('?error_code=otp_expired&next=//evil.com');
 expect(response.status).toBe(302);
 expect(response.headers.get('location')).toBe(`${origin}${expired}`);
});

it('drops an absolute next URL on the failure redirect',async()=>{
 const response=await get('?error_code=otp_expired&next=https://evil.com');
 expect(response.status).toBe(302);
 expect(response.headers.get('location')).toBe(`${origin}${expired}`);
});

it('redirects to /sign-in?error=link when the code exchange returns an error',async()=>{
 m.exchange.mockResolvedValue({error:{code:'bad_pkce',message:'code verifier missing'}});
 const response=await get('?code=SECRET-CODE-123&next=/join/abc');
 expect(response.status).toBe(302);
 expect(response.headers.get('location')).toBe(`${origin}/sign-in?error=link&next=%2Fjoin%2Fabc`);
 expect(m.claimUser).not.toHaveBeenCalled();
 expect(errSpy).toHaveBeenCalledWith('[api/wallet/callback] sign-in failed:',JSON.stringify({reason:'exchange_failed',supabaseCode:'bad_pkce'}));
});

it('redirects to /sign-in?error=link when the code exchange throws',async()=>{
 m.exchange.mockRejectedValue(new Error('network down'));
 const response=await get('?code=abc');
 expect(response.status).toBe(302);
 expect(response.headers.get('location')).toBe(`${origin}${expired}`);
 expect(errSpy).toHaveBeenCalledWith('[api/wallet/callback] sign-in failed:',JSON.stringify({reason:'exchange_failed',supabaseCode:null}));
 expect(logged()).not.toContain('network down');
});

it('logs the reason but never the code value',async()=>{
 m.exchange.mockResolvedValue({error:{code:'bad_pkce',message:'x'}});
 await get('?code=SECRET-CODE-123');
 expect(logged()).toContain('exchange_failed');
 expect(logged()).not.toContain('SECRET-CODE-123');
});

it('drops a supabase code longer than 40 characters from the log',async()=>{
 const long='x'.repeat(41);
 await get(`?error_code=${long}`);
 expect(errSpy).toHaveBeenCalledWith('[api/wallet/callback] sign-in failed:',JSON.stringify({reason:'provider_error',supabaseCode:null}));
});

it('keeps the successful path: code -> session -> claim -> redirect to next',async()=>{
 const response=await get('?code=abc&next=/join/abc');
 expect(response.status).toBe(303);
 expect(response.headers.get('location')).toBe(`${origin}/join/abc`);
 expect(m.exchange).toHaveBeenCalledWith('abc');
 expect(m.claimUser).toHaveBeenCalledWith('auth-id','a@x.com');
 expect(errSpy).not.toHaveBeenCalled();
});

it('redirects to /sign-in?error=link and does not claim when getVerifiedUser refuses the exchanged session',async()=>{
 m.verified.mockResolvedValue(null);
 const response=await get('?code=abc&next=/join/abc');
 expect(m.exchange).toHaveBeenCalledWith('abc');
 expect(response.status).toBe(302);
 expect(response.headers.get('location')).toBe(`${origin}/sign-in?error=link&next=%2Fjoin%2Fabc`);
 expect(m.claimUser).not.toHaveBeenCalled();
 expect(errSpy).toHaveBeenCalledWith('[api/wallet/callback] sign-in failed:',JSON.stringify({reason:'unverified_session',supabaseCode:null}));
 expect(logged()).not.toContain('a@x.com');
});

it('keeps the successful path default redirect to / when next is unsafe',async()=>{
 const response=await get('?code=abc&next=//evil.com');
 expect(response.status).toBe(303);
 expect(response.headers.get('location')).toBe(`${origin}/`);
});
