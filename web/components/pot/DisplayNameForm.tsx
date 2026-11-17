'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MAX_DISPLAY_NAME, parseDisplayName } from '@/lib/profile/displayName';
import { postJson } from './api';

/**
 * One field to set the name other members see instead of your email. Optional: blank clears it.
 * Saves on its own, so it can sit next to another action (joining a pot) without blocking it.
 */
export function DisplayNameForm({ initialName, id = 'display-name' }: { initialName: string | null; id?: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialName ?? '');
  const [value, setValue] = useState(initialName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const dirty = value.trim().replace(/\s+/g, ' ') !== saved;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (busy || !dirty) return;
    const parsed = parseDisplayName(value);
    if (!parsed.ok) { setError(parsed.message); setNotice(null); return; }
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await postJson<{ name: string | null }>('/api/profile/name', { name: parsed.name });
    setBusy(false);
    if (!res.ok) { setError(res.message); return; }
    const next = res.data.name ?? '';
    setSaved(next);
    setValue(next);
    setNotice(next ? 'Saved' : 'Name removed');
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      <Label htmlFor={id}>Your name</Label>
      <div className="flex gap-2">
        <Input id={id} name="display-name" type="text" autoComplete="nickname" maxLength={MAX_DISPLAY_NAME + 20}
          placeholder="How others see you" value={value} aria-describedby={`${id}-help`}
          onChange={e => { setValue(e.target.value); setNotice(null); setError(null); }} />
        <Button type="submit" variant="outline" disabled={busy || !dirty}>{busy ? 'Saving…' : 'Save'}</Button>
      </div>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        Other members see this instead of your email. Optional.
      </p>
      {error && <p role="alert" className="bg-destructive-soft px-3 py-2 text-sm text-destructive">{error}</p>}
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    </form>
  );
}
