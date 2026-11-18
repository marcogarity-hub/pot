import 'server-only';
import { formatUnits } from 'viem';
import { createServerSupabase } from '@/lib/supabase/server';
import type { CreatePotInitial } from './CreatePotForm';
import { MAX_MEMBERS } from './validate';

/** The pot_status columns "Run it again" reads. `members` carries emails only for the organizer (RLS and the view decide). */
export const RUN_AGAIN_COLUMNS =
  'title,total::text,threshold,objection_window_seconds,request_window_seconds,is_organizer,members';

export type RunAgainRow = {
  title: string | null;
  /** 18-decimal base units, as decimal text. */
  total: string;
  threshold: number;
  objection_window_seconds: number;
  request_window_seconds: number;
  is_organizer: boolean | null;
  members: Array<{ email: string | null; active: boolean }> | null;
};

/** Form values from a past pot. Members without a visible email, and members who were swapped out, are left out. */
export function initialFromPot(row: RunAgainRow): CreatePotInitial {
  const emails = (row.members ?? []).filter(m => m.active && m.email).map(m => m.email as string);
  return {
    title: row.title ?? '',
    total: formatUnits(BigInt(row.total), 18),
    members: [...new Set(emails)].slice(0, MAX_MEMBERS),
    threshold: row.threshold,
    objectionWindow: row.objection_window_seconds,
    requestWindow: row.request_window_seconds,
  };
}

/**
 * Loads a pot the signed-in person organizes, for "Run it again". Returns null when the id is not a pot id,
 * the pot is not visible, the person is not its organizer, or the read fails. The caller shows an empty form.
 */
export async function runAgainInitial(potId: string): Promise<CreatePotInitial | null> {
  if (!/^\d+$/.test(potId)) return null;
  try {
    const supabase = await createServerSupabase();
    const { data } = await supabase.from('pot_status').select(RUN_AGAIN_COLUMNS).eq('pot_id', potId).maybeSingle();
    const row = data as RunAgainRow | null;
    if (!row || row.is_organizer !== true) return null;
    return initialFromPot(row);
  } catch {
    return null;
  }
}
