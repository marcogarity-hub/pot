vi.mock('@/lib/pot', async original => ({ ...await original<typeof import('@/lib/pot')>(), get POT_ADDRESS() { return process.env.NEXT_PUBLIC_POT_ADDRESS; } }));
import { beforeEach, expect, it, vi } from 'vitest';
import { encodeAbiParameters, encodeEventTopics, parseUnits } from 'viem';
import { potAbi } from '@/lib/pot';
const m=vi.hoisted(()=>({server:vi.fn(),admin:vi.fn(),ensureUser:vi.fn(),claimUser:vi.fn(),callPot:vi.fn(),insert:vi.fn()}));
vi.mock('@/lib/supabase/server',()=>({createServerSupabase:m.server}));
vi.mock('@/lib/supabase/admin',()=>({createAdminSupabase:m.admin}));
vi.mock('@/lib/circle/identity',()=>({ensureUser:m.ensureUser,claimUser:m.claimUser}));
vi.mock('@/lib/circle/tx',async original=>({...await original<typeof import('@/lib/circle/tx')>(),callPot:m.callPot}));
vi.mock('server-only',()=>({}));
import { POST } from './route';
import { createPotLimiter } from './limiter';
const address='0x1111111111111111111111111111111111111111';
const members=Array.from({length:8},(_,i)=>`friend${i}@x.com`);
const body=()=>({title:'Airbnb',total:'2400',memberEmails:members,deadline:new Date(Date.now()+86400000).toISOString(),threshold:5,objectionWindowSeconds:120,requestWindowSeconds:120});
const post=(data:unknown)=>POST(new Request('https://pot.test/api/pots',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)}));
beforeEach(()=>{
 vi.clearAllMocks();createPotLimiter.clear();process.env.NEXT_PUBLIC_POT_ADDRESS=address;
 m.server.mockResolvedValue({auth:{getUser:async()=>({data:{user:{id:'auth-id',email:' Organizer@x.com '}}})}});
 m.insert.mockResolvedValue({error:null});m.admin.mockReturnValue({from:()=>({insert:m.insert})});
 m.ensureUser.mockImplementation(async(email:string)=>({id:email,circle_wallet_id:email==='organizer@x.com'?'organizer-wallet':email,wallet_address:email==='organizer@x.com'?address:`0x${(members.indexOf(email)+2).toString(16).padStart(40,'0')}`}));
 const topics=encodeEventTopics({abi:potAbi,eventName:'PotCreated',args:{potId:BigInt(42),organizer:address}});
 const data=encodeAbiParameters([{type:'address[]'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'},{type:'uint256'}],[[address],BigInt(2400),BigInt(300),BigInt(100),BigInt(5),BigInt(120),BigInt(120)]);
 m.callPot.mockResolvedValue({transactionHash:'0x1234',logs:[{address,topics,data}]});
});
it('requires a session',async()=>{m.server.mockResolvedValue({auth:{getUser:async()=>({data:{user:null}})}});expect((await post(body())).status).toBe(401);expect(m.ensureUser).not.toHaveBeenCalled();});
it('rejects the sixth create in an hour',async()=>{for(let i=0;i<5;i++)expect((await post(body())).status).toBe(201);expect((await post(body())).status).toBe(429);expect(m.callPot).toHaveBeenCalledTimes(5);});
it('requires an evenly divisible total',async()=>{const response=await post({...body(),total:'100',memberEmails:members.slice(0,3),threshold:2});expect(response.status).toBe(400);expect(await response.json()).toMatchObject({message:'Total must divide evenly by the number of members'});expect(m.ensureUser).not.toHaveBeenCalled();});
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
 const response=await post(body());expect(response.status).toBe(409);expect(await response.json()).toEqual({error:'InvalidParams',message:'InvalidParams'});
});
it('maps a Circle timeout to a pending response with reconciliation id',async()=>{
 const {CircleTimeoutError}=await import('@/lib/circle/tx');m.callPot.mockRejectedValue(new CircleTimeoutError('circle-id'));
 const response=await post(body());expect(response.status).toBe(502);
 expect(await response.json()).toEqual({error:'TransactionPending',message:'Your transaction is still processing. Refresh in a minute before retrying.',circleTransactionId:'circle-id'});
});

it('returns a clear 503 before provisioning when the deployed address is unset', async () => {
 delete process.env.NEXT_PUBLIC_POT_ADDRESS;
 const response = await post(body());
 expect(response.status).toBe(503);
 expect(await response.json()).toEqual({ error: 'PotUnavailable', message: 'NEXT_PUBLIC_POT_ADDRESS is not configured.' });
 expect(m.ensureUser).not.toHaveBeenCalled();
 expect(m.callPot).not.toHaveBeenCalled();
});
