export interface CreatePotLimiter { take(userId: string, now?: number): boolean }
export class InMemoryCreatePotLimiter implements CreatePotLimiter {
  private attempts = new Map<string, number[]>();
  take(userId: string, now = Date.now()): boolean {
    const start = now - 3600000;
    for (const [id,times] of this.attempts) {
      const active = times.filter(time=>time > start);
      if (active.length) this.attempts.set(id,active); else this.attempts.delete(id);
    }
    const times = this.attempts.get(userId) ?? [];
    if (times.length >= 5) return false;
    this.attempts.set(userId,[...times,now]);
    return true;
  }
  clear() { this.attempts.clear(); }
}
// Counts accepted attempts conservatively: an ambiguous chain result must never
// release a slot and allow a caller to bypass the cap. Replace for multi-instance.
export const createPotLimiter = new InMemoryCreatePotLimiter();
