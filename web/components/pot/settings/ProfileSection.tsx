'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { DisplayNameForm } from '@/components/pot/DisplayNameForm';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** The name friends see, the email the account signs in with (read only here), and a row to the wallet page. */
export function ProfileSection({ name, email }: { name: string | null; email: string }) {
  return (
    <div className="space-y-6">
      <h2 className="text-[28px] font-semibold">Profile</h2>
      <div className="space-y-2">
        <DisplayNameForm initialName={name} id="settings-display-name" />
        <p className="text-[15px] text-muted-foreground">Friends in your plans see this name.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-email">Email</Label>
        <Input id="settings-email" type="email" readOnly value={email} />
      </div>
      <Link href="/wallet" className="flex min-h-11 items-center justify-between gap-4 rounded-group bg-card px-4 py-3 text-[15px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        Wallet
        <ChevronRight aria-hidden className="size-5 text-muted-foreground" />
      </Link>
    </div>
  );
}
