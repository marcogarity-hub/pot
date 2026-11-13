import { z } from 'zod';
import { parseUnits } from 'viem';
const uint256Max = BigInt(2) ** BigInt(256) - BigInt(1);
const amount = z.string().regex(/^\d+(\.\d{1,18})?$/, 'Use a USDC amount with at most 18 decimal places').refine(value => {
  if (!/^\d+(\.\d{1,18})?$/.test(value)) return false;
  const units = parseUnits(value,18);
  return units > BigInt(0) && units <= uint256Max;
}, 'Total must be positive and fit uint256');
export const createPotSchema = z.object({
  title: z.string().trim().min(1).max(120),
  total: amount,
  memberEmails: z.array(z.string().trim().toLowerCase().email()).min(1).max(20),
  deadline: z.iso.datetime({offset:true}).refine(value => Math.floor(Date.parse(value)/1000) > Math.floor(Date.now()/1000), 'Deadline must be in the future'),
  threshold: z.number().int().min(1),
  objectionWindowSeconds: z.number().int().min(60).max(7*24*3600),
  requestWindowSeconds: z.number().int().min(60).max(30*24*3600),
}).superRefine((body,ctx)=>{
  if (new Set(body.memberEmails).size !== body.memberEmails.length) ctx.addIssue({code:'custom',path:['memberEmails'],message:'Duplicate member emails'});
  if (body.threshold > body.memberEmails.length) ctx.addIssue({code:'custom',path:['threshold'],message:'Threshold cannot exceed the number of members'});
  if (body.memberEmails.length > 0 && /^\d+(\.\d{1,18})?$/.test(body.total) && parseUnits(body.total,18) % BigInt(body.memberEmails.length) !== BigInt(0)) ctx.addIssue({code:'custom',path:['total'],message:'Total must divide evenly by the number of members'});
});
export type CreatePotBody = z.infer<typeof createPotSchema>;
