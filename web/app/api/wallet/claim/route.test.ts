import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({server:vi.fn(),claimUser:vi.fn(),verified:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createServerSupabase:m.server}));
vi.mock('@/lib/supabase/verified-user',()=>({getVerifiedUser:m.verified}));
vi.mock('@/lib/circle/identity',()=>({
 claimUser:m.claimUser,
 normalizeEmail:(email:string)=>email.trim().toLowerCase(),
}));
vi.mock('server-only',()=>({}));
import { POST } from './route';
const post=()=>POST();
let errSpy: ReturnType<typeof vi.spyOn>;
const logged=()=>errSpy.mock.calls.flat().map(String).join(' ');
beforeEach(()=>{
 vi.clearAllMocks();
 errSpy=vi.spyOn(console,'error').mockImplementation(()=>{});
 m.server.mockResolvedValue({});
 m.verified.mockResolvedValue({id:'auth-id',email:'Member@X.com'});
 m.claimUser.mockResolvedValue(undefined);
});
afterEach(()=>{errSpy.mockRestore();});

it('returns 401 Unauthorized when there is no session',async()=>{
 m.verified.mockResolvedValue(null);
 const response=await post();
 expect(response.status).toBe(401);
 expect(await response.json()).toEqual({error:'Unauthorized'});
 expect(m.claimUser).not.toHaveBeenCalled();
});

it('returns 401 when getVerifiedUser refuses the session (unconfirmed, password or anonymous)',async()=>{
 m.verified.mockResolvedValue(null);
 const response=await post();
 expect(response.status).toBe(401);
 expect(await response.json()).toEqual({error:'Unauthorized'});
 expect(m.claimUser).not.toHaveBeenCalled();
 expect(errSpy).not.toHaveBeenCalled();
});

it('claims the session user with their lower-cased email and returns ok',async()=>{
 const response=await post();
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({ok:true});
 expect(m.claimUser).toHaveBeenCalledTimes(1);
 expect(m.claimUser).toHaveBeenCalledWith('auth-id','member@x.com');
});

it('returns 409 IdentityConflict when the email is linked to a different sign-in',async()=>{
 m.claimUser.mockRejectedValue(new Error('Identity already linked to another account'));
 const response=await post();
 expect(response.status).toBe(409);
 expect(await response.json()).toEqual({error:'IdentityConflict',message:'This email is linked to a different sign-in.'});
});

it('returns 503 with a retry message on any other failure and logs only the error name',async()=>{
 const err=new Error('Could not claim wallet identity for member@x.com auth-id secret-token');
 err.name='WalletClaimError';
 m.claimUser.mockRejectedValue(err);
 const response=await post();
 expect(response.status).toBe(503);
 expect(await response.json()).toEqual({message:'Could not finish signing you in. Please try again.'});
 expect(errSpy).toHaveBeenCalledTimes(1);
 expect(errSpy).toHaveBeenCalledWith('[api/wallet/claim] failed:',JSON.stringify({name:'WalletClaimError'}));
 expect(logged()).not.toContain('member@x.com');
 expect(logged()).not.toContain('auth-id');
 expect(logged()).not.toContain('secret-token');
 expect(logged()).not.toContain('Could not claim');
});
