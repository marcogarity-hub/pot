import { potAbi, POT_ADDRESS } from '@/lib/pot';
import { createStreamsHandler } from './handler';
import { supabaseStore } from './store';

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.QUICKNODE_STREAM_TOKEN;
  const potAddress = POT_ADDRESS;
  if (!secret || !potAddress) {
    return Response.json({ error: 'Streams integration not configured' }, { status: 503 });
  }
  return createStreamsHandler({ abi: potAbi, potAddress, secret, store: supabaseStore() })(request);
}
