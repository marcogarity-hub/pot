import { gunzipSync } from 'node:zlib';
import { type Abi } from 'viem';
import { decodePotLogs } from './decode';
import { foldPot } from './fold';
import { verifyQuickNode } from './verify';
import type { PotStore } from './store';

export function createStreamsHandler(options: { abi: Abi; potAddress: string; secret: string; store: PotStore }) {
  return async function handle(request: Request): Promise<Response> {
    let raw: string;
    try {
      const bytes = Buffer.from(await request.arrayBuffer());
      if (bytes.length > 5 * 1024 * 1024) return Response.json({ error: 'Request body too large' }, { status: 413 });
      const encoding = request.headers.get('Content-Encoding')?.toLowerCase();
      if (encoding && encoding !== 'identity' && encoding !== 'gzip') return Response.json({ error: 'Unsupported encoding' }, { status: 415 });
      raw = (encoding === 'gzip' ? gunzipSync(bytes, { maxOutputLength: 5 * 1024 * 1024 }) : bytes).toString('utf8');
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_BUFFER_TOO_LARGE') return Response.json({ error: 'Request body too large' }, { status: 413 });
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }
    if (!verifyQuickNode(raw, request.headers, options.secret)) return Response.json({ error: 'Invalid signature' }, { status: 401 });
    let events;
    try { events = decodePotLogs(JSON.parse(raw), options.abi, options.potAddress); }
    catch { return Response.json({ error: 'Invalid Streams logs payload' }, { status: 400 }); }
    const potIds = [...new Set(events.map(e => e.potId))];
    try {
      // Store every event before folding. Even if creation is in a later batch,
      // that delivery will reconstruct the pot from the complete stored history.
      await options.store.insertEvents(events);
      for (const potId of potIds) {
        const history = await options.store.loadEvents(potId);
        let projection: ReturnType<typeof foldPot>;
        try {
          projection = foldPot(history);
        } catch (error) {
          const errorName = error instanceof Error ? error.name : 'UnknownError';
          console.error(`Skipping deterministic Streams fold failure for pot ${potId}`, { name: errorName });
          continue;
        }
        const { pot, members } = projection;
        await options.store.upsertProjection(pot, members);
      }
      return Response.json({ events: events.length, pots: potIds.length });
    } catch {
      // A non-2xx response lets Streams retry a partial write or stale fold.
      return Response.json({ error: 'Projection failed; retry delivery' }, { status: 500 });
    }
  };
}
