import { beforeEach, expect, it, vi } from 'vitest';
const m=vi.hoisted(()=>({server:vi.fn(),verified:vi.fn(),admin:vi.fn(),from:vi.fn(),maybeSingle:vi.fn(),eq:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createServerSupabase:m.server}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:m.admin}));
vi.mock('@/lib/supabase/verified-user',()=>({getVerifiedUser:m.verified}));
vi.mock('@/lib/circle/identity',()=>({normalizeEmail:(email:string)=>email.trim().toLowerCase()}));
vi.mock('server-only',()=>({}));
import { GET } from './route';
const wallet='0x1111111111111111111111111111111111111111';
beforeEach(()=>{
 vi.clearAllMocks();
 m.server.mockResolvedValue({});
 m.verified.mockResolvedValue({id:'auth-id',email:' Member@X.com '});
 m.maybeSingle.mockResolvedValue({data:{wallet_address:wallet},error:null});
 m.eq.mockReturnValue({maybeSingle:m.maybeSingle});
 m.from.mockReturnValue({select:()=>({eq:m.eq})});
 m.admin.mockReturnValue({from:m.from});
});

it('returns the normalized email and wallet for a verified session',async()=>{
 const response=await GET();
 expect(response.status).toBe(200);
 expect(await response.json()).toEqual({email:'member@x.com',wallet_address:wallet});
 expect(m.eq).toHaveBeenCalledWith('email','member@x.com');
});

it('returns 401 Unauthorized when there is no session',async()=>{
 m.verified.mockResolvedValue(null);
 const response=await GET();
 expect(response.status).toBe(401);
 expect(await response.json()).toEqual({error:'Unauthorized'});
});

it('answers 401 and makes no wallet lookup when getVerifiedUser refuses the session',async()=>{
 m.verified.mockResolvedValue(null);
 const response=await GET();
 expect(response.status).toBe(401);
 expect(await response.json()).toEqual({error:'Unauthorized'});
 expect(m.admin).not.toHaveBeenCalled();
 expect(m.from).not.toHaveBeenCalled();
 expect(m.maybeSingle).not.toHaveBeenCalled();
});
