import { beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ createWallet: vi.fn(), prefund: vi.fn(), admin: vi.fn(), server: vi.fn(), deleteReserved: vi.fn() }));
vi.mock('./wallets',()=>({createWallet:m.createWallet}));
vi.mock('../relayer',()=>({prefund:m.prefund, PrefundRefusedError: class PrefundRefusedError extends Error {}}));
import { PrefundRefusedError } from '../relayer';
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:m.admin}));
vi.mock('@/lib/supabase/server',()=>({createServerSupabase:m.server}));
import { ensureUser, claimUser, normalizeEmail } from './identity';
import { GET as callback } from '@/app/api/wallet/callback/route';
import { GET as me } from '@/app/api/wallet/me/route';
let rows: Record<string, unknown>[];
beforeEach(()=>{
 vi.clearAllMocks(); rows=[];
 m.createWallet.mockImplementation(async()=>{ await Promise.resolve(); return {walletId:'wallet',address:'0x1111111111111111111111111111111111111111'}; });
 m.prefund.mockResolvedValue('0x1234');
 m.admin.mockImplementation(()=>({from:()=>{
  let action='select'; let value: Record<string,unknown>={}; const filters: Record<string,unknown>={};
  const q = { delete:()=>({eq:(idColumn:string,id:unknown)=>({is:async(column:string,value:unknown)=>{m.deleteReserved(idColumn,id,column,value); rows=rows.filter(row=>!(row[idColumn]===id && row[column]===value));return {error:null};}})}), upsert:(v:Record<string,unknown>)=>{action='insert';value=v;return q;},update:(v:Record<string,unknown>)=>{action='update';value=v;return q;},select:()=>q,eq:(k:string,v:unknown)=>{filters[k]=v;return q;},is:(k:string,v:unknown)=>{filters[k]=v;return q;},or:()=>q,
   maybeSingle:async()=>{
    if(action==='insert'){if(rows.some(r=>r.email===value.email))return {data:null,error:null};const row={id:'internal-id',auth_user_id:null,circle_wallet_id:null,...value};rows.push(row);return {data:row,error:null};}
    const row=rows.find(r=>Object.entries(filters).every(([k,v])=>r[k]===v));if(action==='update'&&row)Object.assign(row,value);return {data:row??null,error:null};
   }
  };return q;
 }}));
 m.server.mockResolvedValue({auth:{exchangeCodeForSession:vi.fn().mockResolvedValue({error:null}),getUser:vi.fn().mockResolvedValue({data:{user:{id:'auth-id',email:'A@x.com'}}})}});
});
it('normalizes email',()=>expect(normalizeEmail(' Alice@X.com ')).toBe('alice@x.com'));
it('concurrent mixed-case ensures provision and fund exactly once',async()=>{
 const [a,b]=await Promise.all([ensureUser(' A@x.com '),ensureUser('a@x.com')]);
 expect(a.wallet_address).toBe(b.wallet_address);expect(m.createWallet).toHaveBeenCalledTimes(1);expect(m.prefund).toHaveBeenCalledTimes(1);expect(rows).toHaveLength(1);
});
it('claim links internal row without replacing its id or creating a wallet',async()=>{
 rows.push({id:'internal-id',email:'a@x.com',auth_user_id:null,circle_wallet_id:'wallet',wallet_address:'0x1111111111111111111111111111111111111111'});
 await claimUser('auth-id',' A@x.com');expect(m.createWallet).not.toHaveBeenCalled();expect(rows[0]).toMatchObject({id:'internal-id',auth_user_id:'auth-id',claimed:true});
});
it.each(['https://evil.com','//evil.com','/\\evil.com','/%2f%2fevil.com'])('callback rejects unsafe next %s',async(next)=>{
 const response=await callback(new Request(`https://pot.test/api/wallet/callback?code=ok&next=${encodeURIComponent(next)}`));expect(response.headers.get('location')).toBe('https://pot.test/');
});
it('callback preserves a join invite path',async()=>{
 const response=await callback(new Request('https://pot.test/api/wallet/callback?code=ok&next=/join/token'));expect(response.headers.get('location')).toBe('https://pot.test/join/token');
});
it('me returns normalized identity',async()=>{const response=await me();expect(await response.json()).toEqual({email:'a@x.com',wallet_address:'0x1111111111111111111111111111111111111111'});});
it('me rejects unauthenticated callers',async()=>{m.server.mockResolvedValue({auth:{getUser:async()=>({data:{user:null}})}});expect((await me()).status).toBe(401);});
it('times out waiting for an already-reserved identity without provisioning again',async()=>{
 vi.useFakeTimers();
 try { rows.push({id:'pending',email:'a@x.com',auth_user_id:null});const pending=expect(ensureUser('a@x.com')).rejects.toThrow('provisioning pending');await vi.advanceTimersByTimeAsync(10000);await pending;expect(m.createWallet).not.toHaveBeenCalled();expect(m.prefund).not.toHaveBeenCalled(); } finally {vi.useRealTimers();}
});
it('keeps the reservation after an ambiguous prefunding failure',async()=>{
 m.prefund.mockRejectedValue(new Error('connection lost after send'));await expect(ensureUser('a@x.com')).rejects.toThrow('connection lost after send');expect(rows[0].wallet_address).toBeUndefined();expect(m.deleteReserved).not.toHaveBeenCalled();
});
it('does not reassign a wallet linked to a different auth user',async()=>{
 rows.push({id:'internal-id',email:'a@x.com',auth_user_id:'someone-else',circle_wallet_id:'wallet',wallet_address:'0x1111111111111111111111111111111111111111'});await expect(claimUser('auth-id','a@x.com')).rejects.toThrow('already linked');expect(rows[0].auth_user_id).toBe('someone-else');
});

it.each(['createWallet', 'cap refusal'])('releases a reservation after %s failure and allows a later successful ensure', async (reason) => {
 const failure = reason === 'createWallet' ? new Error('Circle unavailable') : new PrefundRefusedError('Daily prefund cap exceeded');
 if (reason === 'createWallet') m.createWallet.mockRejectedValueOnce(failure);
 else m.prefund.mockRejectedValueOnce(failure);
 await expect(ensureUser(' A@x.com ')).rejects.toBe(failure);
 expect(m.deleteReserved).toHaveBeenCalledWith('id','internal-id','circle_wallet_id',null);
 expect(rows).toHaveLength(0);
 const user = await ensureUser('a@x.com');
 expect(user).toMatchObject({circle_wallet_id:'wallet',wallet_address:'0x1111111111111111111111111111111111111111'});
 expect(rows).toHaveLength(1);
});
