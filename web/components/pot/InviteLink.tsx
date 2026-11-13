'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** Organizer-only invite link with a copy button. */
export function InviteLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const origin = process.env.NEXT_PUBLIC_APP_URL || (typeof window === 'undefined' ? '' : window.location.origin);
  const url = `${origin.replace(/\/$/, '')}/join/${token}`;
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Invite link</p>
      <div className="flex gap-2">
        <Input readOnly value={url} aria-label="Invite link" onFocus={e => e.currentTarget.select()} />
        <Button type="button" variant="outline" size="icon" aria-label="Copy invite link"
          onClick={async () => {
            try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* clipboard blocked */ }
          }}>
          {copied ? <Check /> : <Copy />}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">Only people whose emails you added can join with it.</p>
    </div>
  );
}
