'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import type { PotRow, MemberRow } from '@/app/api/streams/fold';
export type { PotRow, MemberRow } from '@/app/api/streams/fold';
export type PotStatusRow = PotRow & {
  updated_at: string; title: string | null; invite_token: string | null;
  receipt_text: string | null; created_at: string | null; is_organizer: boolean | null;
  members: Array<Omit<MemberRow, 'pot_id'> & { email: string | null; is_organizer: boolean }>;
};
// PostgREST numeric columns must be cast to text before JSON serialization.
const columns = 'pot_id::text,organizer_address,total::text,share::text,deadline,threshold,objection_window_seconds,request_window_seconds,locked_at,state,payments_count,objections_count,receipt_hash,release_eligible_at,updated_at,title,invite_token,receipt_text,created_at,is_organizer,members';

export function usePot(potId: string): { status: PotStatusRow | null; loading: boolean; refetch(): Promise<void> } {
  const [result, setResult] = useState<{ potId: string; status: PotStatusRow | null; loading: boolean }>({ potId, status: null, loading: true });
  const runner = useRef<(() => Promise<void>) | null>(null);
  const refetch = useCallback(async () => { await runner.current?.(); }, []);

  useEffect(() => {
    const db = createBrowserSupabase();
    let disposed = false;
    let dirty = false;
    let inFlight: Promise<void> | null = null;
    const refresh = (): Promise<void> => {
      if (disposed) return Promise.resolve();
      dirty = true;
      if (inFlight) return inFlight;
      inFlight = (async () => {
        // Serialize reads and queue invalidations. A response known to precede
        // a change is never published; read again before ending initial load.
        while (dirty && !disposed) {
          dirty = false;
          try {
            const { data, error } = await db.from('pot_status').select(columns).eq('pot_id', potId).maybeSingle();
            if (error) throw error;
            if (!disposed && !dirty) setResult({ potId, status: data as PotStatusRow | null, loading: false });
          } catch {
            // Preserve the last successful row; reconnect/manual refetch retries.
            // The requested public hook interface has no error field.
            if (!disposed && !dirty) setResult(previous => ({ ...previous, loading: false }));
          }
        }
      })().finally(() => {
        inFlight = null;
        // A notification can land between the loop finishing and this cleanup.
        if (dirty && !disposed) return refresh();
      });
      return inFlight;
    };
    runner.current = refresh;
    const channel = db.channel(`pot:${potId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pots', filter: `pot_id=eq.${potId}` }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pot_members', filter: `pot_id=eq.${potId}` }, () => { void refresh(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pot_meta', filter: `pot_id=eq.${potId}` }, () => { void refresh(); })
      .subscribe(state => { if (state === 'SUBSCRIBED') void refresh(); });
    void refresh();
    return () => {
      disposed = true;
      if (runner.current === refresh) runner.current = null;
      void db.removeChannel(channel);
    };
  }, [potId]);

  return { status: result.potId === potId ? result.status : null, loading: result.potId !== potId || result.loading, refetch };
}
