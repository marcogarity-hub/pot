import { gunzipSync } from 'node:zlib';
import { type Abi } from 'viem';
import { decodePotLogs } from './decode';
import { foldPot } from './fold';
import { verifyQuickNode } from './verify';
import type { PotStore } from './store';

const MAX_LOG_TEXT = 200;
const SHAPE_DEPTH = 3;
const SHAPE_KEYS = 12;
const SHAPE_ITEMS = 3;
const MIN_SECRET_LENGTH = 8;

/** Type, array lengths and key names only, never values, down to SHAPE_DEPTH. */
function summarizeShape(value: unknown, depth = 0): unknown {
  if (value === null) return 'null';
  if (Array.isArray(value)) {
    const node: Record<string, unknown> = { type: 'array', length: value.length };
    if (depth < SHAPE_DEPTH) node.items = value.slice(0, SHAPE_ITEMS).map(item => summarizeShape(item, depth + 1));
    return node;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    const node: Record<string, unknown> = { type: 'object', keys: keys.slice(0, SHAPE_KEYS).map(key => key.slice(0, 64)) };
    if (depth < SHAPE_DEPTH) {
      node.children = Object.fromEntries(keys.slice(0, SHAPE_KEYS).map(key => [key.slice(0, 64), summarizeShape((value as Record<string, unknown>)[key], depth + 1)]));
    }
    return node;
  }
  return typeof value;
}

function errorName(error: unknown): string {
  return (error instanceof Error ? error.name : 'UnknownError').slice(0, MAX_LOG_TEXT);
}

/** Redacts configured secrets, hides long hex (addresses, topics, data) and truncates. */
function errorMessage(error: unknown, secrets: (string | undefined)[] = []): string {
  let message = error instanceof Error ? error.message : '';
  for (const secret of secrets) {
    if (secret && secret.length >= MIN_SECRET_LENGTH) message = message.split(secret).join('[redacted]');
  }
  return message.replace(/0x[\da-fA-F]{40,}/g, '[hex]').slice(0, MAX_LOG_TEXT);
}

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
    let parsed: unknown;
    try { parsed = JSON.parse(raw); }
    catch (error) {
      // The SyntaxError message can quote body text, so only its name is logged.
      console.error(`[api/streams] payload rejected: ${JSON.stringify({ shape: 'not json', bytes: Buffer.byteLength(raw, 'utf8'), error: { name: errorName(error) } })}`);
      return Response.json({ error: 'Invalid Streams logs payload' }, { status: 400 });
    }
    let events;
    try { events = decodePotLogs(parsed, options.abi, options.potAddress); }
    catch (error) {
      console.error(`[api/streams] payload rejected: ${JSON.stringify({ shape: summarizeShape(parsed), error: { name: errorName(error), message: errorMessage(error) } })}`);
      return Response.json({ error: 'Invalid Streams logs payload' }, { status: 400 });
    }
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
    } catch (error) {
      console.error(`[api/streams] projection failed: ${JSON.stringify({ error: { name: errorName(error), message: errorMessage(error, [process.env.SUPABASE_SECRET_KEY, process.env.QUICKNODE_STREAM_TOKEN]) } })}`);
      // A non-2xx response lets Streams retry a partial write or stale fold.
      return Response.json({ error: 'Projection failed; retry delivery' }, { status: 500 });
    }
  };
}
