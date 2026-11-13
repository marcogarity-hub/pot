/** Small fetch helper for the Pot API. Error bodies carry { error, message }. */
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; message: string };

export async function postJson<T>(url: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return { ok: false, status: 0, message: 'Network error. Check your connection and try again.' };
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.ok) return { ok: true, status: res.status, data: data as T };
  const message = typeof data.message === 'string' ? data.message
    : res.status === 401 ? 'Please sign in again.'
    : res.status === 403 ? 'Only the organizer can do that.'
    : typeof data.error === 'string' ? data.error
    : 'Something went wrong. Please try again.';
  return { ok: false, status: res.status, message };
}
