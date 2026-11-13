import { postJson, type ApiResult } from './api';

export type FinalizeResult = ApiResult<{ transactionHash?: string }>;

// One finalize request per pot at a time. The auto tick and the Finalize button both go through here,
// so a button press during an auto tick joins that request instead of sending a second one.
const inFlight = new Map<string, Promise<FinalizeResult>>();

export function finalizePot(potId: string): Promise<FinalizeResult> {
  const existing = inFlight.get(potId);
  if (existing) return existing;
  const request = postJson<{ transactionHash?: string }>(`/api/pots/${potId}/finalize`)
    .finally(() => { inFlight.delete(potId); });
  inFlight.set(potId, request);
  return request;
}
