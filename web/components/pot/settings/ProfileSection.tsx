'use client';

import { DisplayNameForm } from '@/components/pot/DisplayNameForm';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

/** The name friends see, and the email the account signs in with (read only here). */
export function ProfileSection({ name, email }: { name: string | null; email: string }) {
  return (
    <div className="space-y-6">
      <h2 className="text-[22px] font-semibold">Profile</h2>
      <div className="space-y-2">
        <DisplayNameForm initialName={name} id="settings-display-name" />
        <p className="text-[15px] text-muted-foreground">Friends in your pots see this name.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="settings-email">Email</Label>
        <Input id="settings-email" type="email" readOnly value={email} />
      </div>
    </div>
  );
}
