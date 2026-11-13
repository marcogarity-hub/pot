import { isAddress } from 'viem';
import { potAbi } from './abi-placeholder';
import { createStreamsHandler } from './handler';
import { supabaseStore } from './store';

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.QUICKNODE_STREAM_TOKEN;
  const potAddress = process.env.NEXT_PUBLIC_POT_ADDRESS;
  if (!secret || !potAddress || !isAddress(potAddress) || /^0x0{40}$/i.test(potAddress) || !potAbi.length) {
    return Response.json({ error: 'Streams integration not configured' }, { status: 503 });
  }
  return createStreamsHandler({ abi: potAbi, potAddress, secret, store: supabaseStore() })(request);
}
