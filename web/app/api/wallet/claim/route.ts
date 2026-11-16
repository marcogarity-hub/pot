import { createServerSupabase } from '@/lib/supabase/server';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { claimUser, normalizeEmail } from '@/lib/circle/identity';
const CONFLICT_MESSAGE = 'Identity already linked to another account';
/** Links the signed-in auth user to their wallet row. Called by the browser right after a code sign-in. Never provisions wallets. */
export async function POST() {
  const supabase = await createServerSupabase();
  const user = await getVerifiedUser(supabase);
  if (!user) return Response.json({error:'Unauthorized'},{status:401});
  try {
    await claimUser(user.id, normalizeEmail(user.email));
    return Response.json({ok:true});
  } catch (caught) {
    if (caught instanceof Error && caught.message === CONFLICT_MESSAGE) {
      return Response.json({error:'IdentityConflict',message:'This email is linked to a different sign-in.'},{status:409});
    }
    console.error('[api/wallet/claim] failed:', JSON.stringify({ name: (caught as { name?: unknown } | null)?.name }));
    return Response.json({message:'Could not finish signing you in. Please try again.'},{status:503});
  }
}
