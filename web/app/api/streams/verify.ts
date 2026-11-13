import { createHmac, timingSafeEqual } from 'node:crypto';

/** rawBody is the exact uncompressed UTF-8 body, never reserialized JSON. */
export function verifyQuickNode(rawBody: string, headers: Headers, secret: string): boolean {
  const nonce = headers.get('X-QN-Nonce');
  const timestamp = headers.get('X-QN-Timestamp');
  const signature = headers.get('X-QN-Signature');
  if (!secret || !nonce || !timestamp || !signature || !/^[\da-f]{64}$/i.test(signature)) return false;
  const expected = createHmac('sha256', secret).update(nonce + timestamp + rawBody, 'utf8').digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
