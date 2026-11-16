vi.mock('@/lib/pot', async original => ({ ...await original<typeof import('@/lib/pot')>(), get POT_ADDRESS() { return process.env.NEXT_PUBLIC_POT_ADDRESS; } }));
import { beforeEach, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseUnits } from 'viem';
import { potAbi } from '@/lib/pot';
const m=vi.hoisted(()=>({server:vi.fn(),verified:vi.fn(),admin:vi.fn(),ensureUser:vi.fn(),claimUser:vi.fn(),callPot:vi.fn(),insert:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createServerSupabase:m.server}));
vi.mock('@/lib/supabase/verified-user',()=>({getVerifiedUser:m.verified}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:m.admin}));
vi.mock('@/lib/circle/identity',()=>({ensureUser:m.ensureUser,claimUser:m.claimUser}));
vi.mock('@/lib/circle/tx',async original=>({...await original<typeof import('@/lib/circle/tx')>(),callPot:m.callPot}));
vi.mock('server-only',()=>({}));
import { POST } from './route';
import { createPotSchema, MAX_DEADLINE_SECONDS } from './schema';
import { validationMessage } from './errors';
import { createPotLimiter } from './limiter';
const address='0x1111111111111111111111111111111111111111';
const members=Array.from({length:8},(_,i)=>`friend${i}@x.com`);
const body=()=>({title:'Airbnb',total:'2400',memberEmails:members,deadline:new Date(Date.now()+86400000).toISOString(),threshold:5,objectionWindowSeconds:120,requestWindowSeconds:120});
const post=(data:unknown)=>POST(new Request('https://pot.test/api/pots',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}));
it('accepts a deadline exactly at the one-year limit',()=>{
 vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
 const nowSeconds=Math.floor(Date.now()/1000);
 const deadline=new Date((nowSeconds+MAX_DEADLINE_SECONDS)*1000).toISOString();
 expect(createPotSchema.safeParse({...body(),deadline}).success).toBe(true);
 vi.useRealTimers();
});
it('rejects a deadline one second beyond the one-year limit with a labelled message',()=>{
 vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
 const nowSeconds=Math.floor(Date.now()/1000);
 const deadline=new Date((nowSeconds+MAX_DEADLINE_SECONDS+1)*1000).toISOString();
 const result=createPotSchema.safeParse({...body(),deadline});
 expect(result.success).toBe(false);
 if (!result.success) {
  expect(result.error.issues[0].message).toBe('Deadline must be within one year');
  expect(validationMessage(result.error.issues[0])).toBe('Deadline: Deadline must be within one year');
 }
 vi.useRealTimers();
});
it('keeps the existing past-deadline validation message',()=>{
 vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
 const result=createPotSchema.safeParse({...body(),deadline:'2000-01-01T00:00:00Z'});
 expect(result.success).toBe(false);
 if (!result.success) expect(result.error.issues[0].message).toBe('Deadline must be in the future');
 vi.useRealTimers();
});
beforeEach(()=>{
 vi.clearAllMocks();createPotLimiter.clear();process.env.NEXT_PUBLIC_POT_ADDRESS=address;
 m.server.mockResolvedValue({});
 m.verified.mockResolvedValue({id:'auth-id',email:' Organizer@x.com '});
 m.insert.mockResolvedValue({error:null});m.admin.mockReturnValue({from:()=>({insert:m.insert})});
 m.ensureUser.mockImplementation(async(email:string)=>({id:email,circle_wallet_id:email==='organizer@x.com'?'organizer-wallet':email,wallet_address:email==='organizer@x.com'?address:`0x${(members.indexOf(email)+2).toString(16).padStart(40,'0')}`}));
 const topics=encodeEventTopics({abi:potAbi,eventName:'PotCreated',args:{potId:BigInt(42),organizer:address}});
 const data=encodeAbiParameters([{type:'address[]'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'}],[[address],BigInt(2400),BigInt(300),BigInt(100),BigInt(5),BigInt(120),BigInt(120)]);
 m.callPot.mockResolvedValue({transactionHash:'0x1234',logs:[{address,topics,data}]});
});
it('requires a session',async()=>{m.verified.mockResolvedValue(null);expect((await post(body())).status).toBe(401);expect(m.ensureUser).not.toHaveBeenCalled();});
it('answers 401 Unauthorized and makes no provisioning, claim, chain or database calls when getVerifiedUser refuses the session',async()=>{
 m.verified.mockResolvedValue(null);
 const response=await post(body());
 expect(response.status).toBe(401);
 expect(await response.json()).toEqual({error:'Unauthorized'});
 expect(m.ensureUser).not.toHaveBeenCalled();
 expect(m.claimUser).not.toHaveBeenCalled();
 expect(m.callPot).not.toHaveBeenCalled();
 expect(m.admin).not.toHaveBeenCalled();
 expect(m.insert).not.toHaveBeenCalled();
});
it('rejects a far-future deadline with the labelled one-year message',async()=>{
 vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
 const nowSeconds=Math.floor(Date.now()/1000);
 const deadline=new Date((nowSeconds+MAX_DEADLINE_SECONDS+86400)*1000).toISOString();
 const response=await post({...body(),deadline});
 expect(response.status).toBe(400);
 expect(await response.json()).toEqual({message:'Deadline: Deadline must be within one year'});
 expect(m.ensureUser).not.toHaveBeenCalled();
 vi.useRealTimers();
});
it('rejects the sixth create in an hour',async()=>{for(let i=0;i<5;i++)expect((await post(body())).status).toBe(201);expect((await post(body())).status).toBe(429);expect(m.callPot).toHaveBeenCalledTimes(5);});
it('requires an evenly divisible total',async()=>{const response=await post({...body(),total:'100',memberEmails:members.slice(0,3),threshold:2});expect(response.status).toBe(400);expect(await response.json()).toMatchObject({message:'Total: Total must divide evenly by the number of members'});expect(m.ensureUser).not.toHaveBeenCalled();});
it.each([{field:'title',value:'',expected:'Name: Too small: expected string to have >=1 characters'},{field:'total',value:'abc',expected:'Total: Use a USDC amount with at most 18 decimal places'}])('labels create validation errors',async({field,value,expected})=>{const response=await post({...body(),[field]:value});expect(response.status).toBe(400);expect(await response.json()).toEqual({message:expected});});
it('rejects normalized duplicates before provisioning',async()=>{expect((await post({...body(),memberEmails:[' A@x.com ','a@x.com'],threshold:1})).status).toBe(400);expect(m.ensureUser).not.toHaveBeenCalled();});
it.each([
 {memberEmails:Array.from({length:21},(_,i)=>`a${i}@x.com`)}, {memberEmails:[]}, {total:'0'}, {total:'-1'}, {total:'1.0000000000000000001'}, {threshold:0}, {threshold:9}, {threshold:1.5}, {deadline:'2000-01-01T00:00:00Z'}, {objectionWindowSeconds:59}, {objectionWindowSeconds:604801}, {requestWindowSeconds:59}, {requestWindowSeconds:2592001},
])('rejects invalid creation input %j',async(patch)=>{expect((await post({...body(),...patch})).status).toBe(400);expect(m.ensureUser).not.toHaveBeenCalled();});
it('allows organizer as a member',async()=>{expect((await post({...body(),memberEmails:[' ORGANIZER@x.com '],threshold:1})).status).toBe(201);});
it('uses real potAbi to decode PotCreated, sends exact createPot args, and saves metadata',async()=>{
 const input=body();const response=await post(input);expect(response.status).toBe(201);const result=await response.json();expect(result).toEqual({potId:'42',inviteToken:expect.any(String)});
 expect(m.callPot).toHaveBeenCalledWith('organizer-wallet','createPot',[parseUnits('2400',18),parseUnits('300',18),members.map((_,index)=>`0x${(index+2).toString(16).padStart(40,'0')}`),BigInt(Math.floor(Date.parse(input.deadline)/1000)),BigInt(5),BigInt(120),BigInt(120)]);
 expect(m.claimUser).toHaveBeenCalledWith('auth-id','organizer@x.com');
 expect(m.insert).toHaveBeenCalledWith({pot_id:'42',title:'Airbnb',invite_token:result.inviteToken});expect(m.insert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({pot_id:'42',email:'friend0@x.com',address:`0x${'2'.padStart(40,'0')}`})]));
});
it('does not persist without a PotCreated log from the configured contract',async()=>{m.callPot.mockResolvedValue({logs:[{address:`0x${'9'.repeat(40)}`,topics:[],data:'0x'}]});expect((await post(body())).status).toBe(502);expect(m.insert).not.toHaveBeenCalled();});
it('does not send after invalid provisioned address',async()=>{m.ensureUser.mockResolvedValue({circle_wallet_id:'w',wallet_address:`0x${'0'.repeat(40)}`});expect((await post(body())).status).toBe(400);expect(m.callPot).not.toHaveBeenCalled();});
it('reports confirmed pot id if metadata persistence fails',async()=>{m.insert.mockResolvedValue({error:{message:'db unavailable'}});const response=await post(body());expect(response.status).toBe(503);expect(await response.json()).toMatchObject({potId:'42'});expect(m.callPot).toHaveBeenCalledTimes(1);});
it('limits simultaneous requests before any async provisioning completes',async()=>{
 const responses=await Promise.all(Array.from({length:6},()=>post(body())));expect(responses.map(r=>r.status).sort()).toEqual([201,201,201,201,201,429]);expect(m.callPot).toHaveBeenCalledTimes(5);
});
it('expires a creation slot at exactly one hour',()=>{for(let i=0;i<5;i++)expect(createPotLimiter.take('user',1000)).toBe(true);expect(createPotLimiter.take('user',3600999)).toBe(false);expect(createPotLimiter.take('user',3601000)).toBe(true);expect(createPotLimiter.take('other',1000)).toBe(true);});
it('does not write invites when metadata fails',async()=>{m.insert.mockResolvedValueOnce({error:{message:'failed'}});await post(body());expect(m.insert).toHaveBeenCalledTimes(1);});
it('maps create contract reverts to 409 with code',async()=>{
 const {PotRevertError}=await import('@/lib/circle/tx');
 m.callPot.mockRejectedValue(new PotRevertError('InvalidParams'));
 const response=await post(body());expect(response.status).toBe(409);expect(await response.json()).toEqual({error:'InvalidParams',message:'Check the pot details and try again.'});
});
it('maps a Circle timeout to a pending response with reconciliation id',async()=>{
 const {CircleTimeoutError}=await import('@/lib/circle/tx');m.callPot.mockRejectedValue(new CircleTimeoutError('circle-id'));
 const response=await post(body());expect(response.status).toBe(502);
 expect(await response.json()).toEqual({error:'CreatePending',message:'Your pot is still being created. Do not submit again — refresh in a minute.',circleTransactionId:'circle-id'});
});
it('maps an identity conflict to 409',async()=>{
 m.claimUser.mockRejectedValue(new Error('Identity already linked to another account'));
 const response=await post(body());expect(response.status).toBe(409);expect(await response.json()).toEqual({error:'IdentityConflict',message:'This email is linked to a different sign-in.'});expect(m.callPot).not.toHaveBeenCalled();
});

it('returns a clear 503 before provisioning when the deployed address is unset', async () => {
 delete process.env.NEXT_PUBLIC_POT_ADDRESS;
 const response = await post(body());
 expect(response.status).toBe(503);
 expect(await response.json()).toEqual({ error: 'PotUnavailable', message: 'NEXT_PUBLIC_POT_ADDRESS is not configured.' });
 expect(m.ensureUser).not.toHaveBeenCalled();
 expect(m.callPot).not.toHaveBeenCalled();
});

it('logs one redacted [api/pots] line when provisioning fails and keeps the 503 body', async () => {
 const secret='k3y-value-9876';process.env.CIRCLE_API_KEY=secret;
 m.ensureUser.mockRejectedValueOnce(new Error(`Circle rejected ${secret} with Bearer abc123`));
 const spy=vi.spyOn(console,'error').mockImplementation(()=>{});
 try {
  const response=await post(body());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({message:'Wallet provisioning pending. Please retry shortly.'});
  expect(spy).toHaveBeenCalledTimes(1);
  const line=String(spy.mock.calls[0][0]);
  expect(line.startsWith('[api/pots]')).toBe(true);
  expect(line).not.toContain(secret);
  expect(line).not.toContain('abc123');
 } finally {
  spy.mockRestore();delete process.env.CIRCLE_API_KEY;
 }
});
