import { createServerSupabase } from '@/lib/supabase/server';
import { createAdminSupabase } from '@/lib/supabase/admin';
import { getVerifiedUser } from '@/lib/supabase/verified-user';
import { normalizeEmail } from '@/lib/circle/identity';
export async function GET() {
  const supabase = await createServerSupabase();
  const verified = await getVerifiedUser(supabase);
  if (!verified) return Response.json({error:'Unauthorized'},{status:401});
  try {
    const admin = createAdminSupabase();
    const user = await admin.from('users').select('wallet_address').eq('email', normalizeEmail(verified.email)).maybeSingle();
    if (user.error) throw new Error('Wallet lookup failed');
    if (!user.data?.wallet_address) return Response.json({error:'NoWallet'},{status:404});
    return Response.json({email:normalizeEmail(verified.email),wallet_address:user.data.wallet_address});
  } catch { return Response.json({error:'InternalServerError'},{status:500}); }
}
