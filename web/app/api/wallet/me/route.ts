import { createServerSupabase } from '@/lib/supabase/server';
import { ensureUser, normalizeEmail } from '@/lib/circle/identity';
export async function GET() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return Response.json({error:'Unauthorized'},{status:401});
  try {
    const user = await ensureUser(data.user.email);
    return Response.json({email:normalizeEmail(data.user.email),wallet_address:user.wallet_address});
  } catch { return Response.json({error:'Wallet provisioning pending'},{status:503}); }
}
