'use client';

import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/browser';
import { Button } from '@/components/ui/button';

export function SignOutButton() {
  const router = useRouter();
  return (
    <Button variant="ghost" size="sm" onClick={async () => { await createBrowserSupabase().auth.signOut(); router.refresh(); }}>
      Sign out
    </Button>
  );
}
