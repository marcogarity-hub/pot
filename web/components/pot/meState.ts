/**
 * The signed-in user's wallet state, as reported by GET /api/wallet/me.
 * Each kind needs a different UI: only `ready` may take pot actions.
 */
export type MeState =
  | { kind: 'signed-out' }
  | { kind: 'no-wallet'; email?: string }
  | { kind: 'error' }
  | { kind: 'ready'; email: string; wallet_address: string };

/** Maps one /api/wallet/me response to a state. Anything unexpected is `error`. */
export function meStateFromResponse(status: number, body: unknown): MeState {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  if (status === 200) {
    if (typeof b.email === 'string' && typeof b.wallet_address === 'string') {
      return { kind: 'ready', email: b.email, wallet_address: b.wallet_address };
    }
    return { kind: 'error' };
  }
  if (status === 401) return { kind: 'signed-out' };
  if (status === 404 && b.error === 'NoWallet') {
    return typeof b.email === 'string' ? { kind: 'no-wallet', email: b.email } : { kind: 'no-wallet' };
  }
  return { kind: 'error' };
}

/** Fetches /api/wallet/me. A network failure or an unreadable body is `error`, not signed-out. */
export async function fetchMeState(fetchFn: typeof fetch = fetch): Promise<MeState> {
  try {
    const res = await fetchFn('/api/wallet/me', { cache: 'no-store' });
    let body: unknown = null;
    try { body = await res.json(); } catch { return meStateFromResponse(res.status, null); }
    return meStateFromResponse(res.status, body);
  } catch {
    return { kind: 'error' };
  }
}
