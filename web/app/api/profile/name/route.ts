import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { parseDisplayName } from '@/lib/profile/displayName';

/** Saves the signed-in member's display name. Other members of their pots see it instead of their email. Blank clears it. */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const user = await getVerifiedUser(supabase);
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  if (!body || typeof body !== 'object' || !('name' in body)) {
    return Response.json({ error: 'BadRequest', message: 'Enter a name.' }, { status: 400 });
  }
  const parsed = parseDisplayName(body.name);
  if (!parsed.ok) return Response.json({ error: 'InvalidName', message: parsed.message }, { status: 400 });

  try {
    const saved = await createAdminSupabase().from('users').update({ display_name: parsed.name })
      .eq('auth_user_id', user.id).select('id').maybeSingle();
    if (saved.error) throw new Error('Name save failed');
    if (!saved.data) return Response.json({ error: 'NoAccount', message: 'Finish signing in, then try again.' }, { status: 404 });
    return Response.json({ ok: true, name: parsed.name });
  } catch (caught) {
    console.error('[api/profile/name] failed:', JSON.stringify({ name: (caught as { name?: unknown } | null)?.name }));
    return Response.json({ error: 'InternalServerError', message: 'Could not save your name. Please try again.' }, { status: 500 });
  }
}
