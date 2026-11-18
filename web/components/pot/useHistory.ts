'use client';

import { useCallback, useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import {
  HISTORY_EVENT_NAMES, buildHistory,
  type HistoryEventRow, type HistoryItem, type HistoryPotMeta,
} from './historyModel';

export type HistoryState = { items: HistoryItem[]; loading: boolean; error: boolean; retry: () => void };

/** Upper bound on rows read. RLS already limits them to pots the viewer is in. */
const EVENT_LIMIT = 1000;

/**
 * Reads the signed-in viewer's money movements through the browser client, so RLS decides what is visible.
 * The viewer's wallet comes from their own users row. Without a wallet the list is empty, not an error.
 */
async function loadHistory(): Promise<HistoryItem[]> {
  const db = createBrowserSupabase();
  const { data: me, error: meError } = await db.from('users').select('wallet_address').maybeSingle();
  if (meError) throw meError;
  const wallet = (me as { wallet_address: string | null } | null)?.wallet_address ?? null;
  if (!wallet) return [];

  const { data: eventData, error: eventError } = await db
    .from('pot_events')
    .select('id,pot_id::text,event_name,args')
    .in('event_name', [...HISTORY_EVENT_NAMES])
    .order('id', { ascending: false })
    .limit(EVENT_LIMIT);
  if (eventError) throw eventError;
  const events = (eventData ?? []) as unknown as HistoryEventRow[];

  const potIds = [...new Set(events.map(e => e.pot_id))];
  let potMeta: HistoryPotMeta[] = [];
  if (potIds.length > 0) {
    const { data: metaData, error: metaError } = await db
      .from('pot_meta')
      .select('pot_id::text,title,receipt_text')
      .in('pot_id', potIds);
    if (metaError) throw metaError;
    potMeta = (metaData ?? []) as unknown as HistoryPotMeta[];
  }
  return buildHistory(events, potMeta, wallet);
}

/** The viewer's payments, refunds and payouts. `retry` loads again after an error. */
export function useHistory(): HistoryState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ items: HistoryItem[]; loading: boolean; error: boolean }>({
    items: [], loading: true, error: false,
  });

  useEffect(() => {
    let cancelled = false;
    loadHistory()
      .then(items => { if (!cancelled) setState({ items, loading: false, error: false }); })
      .catch(() => { if (!cancelled) setState({ items: [], loading: false, error: true }); });
    return () => { cancelled = true; };
  }, [attempt]);

  const retry = useCallback(() => {
    setState(s => ({ ...s, loading: true, error: false }));
    setAttempt(n => n + 1);
  }, []);

  return { ...state, retry };
}
