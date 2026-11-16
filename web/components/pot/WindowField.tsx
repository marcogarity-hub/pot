'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type Preset = { label: string; seconds: number };

/** Preset dropdown plus a custom minutes field. `seconds` is the chosen window. */
export function WindowField({ id, label, hint, presets, seconds, onChange, error }: {
  id: string; label: string; hint: string; presets: Preset[];
  seconds: number; onChange(seconds: number): void; error?: string;
}) {
  const match = presets.find(p => p.seconds === seconds);
  // Custom mode latches: typing a value that happens to equal a preset must not unmount the input.
  // It ends only when the user picks a preset. A value that matches no preset always shows the input.
  const [customChosen, setCustomChosen] = useState(() => !match);
  const showCustom = customChosen || !match;
  const choice = showCustom ? 'custom' : String(match.seconds);
  const items = [...presets.map(p => ({ value: String(p.seconds), label: p.label })), { value: 'custom', label: 'Custom' }];
  return (
    <div className="min-w-0 space-y-2">
      <Label htmlFor={`${id}-trigger`}>{label}</Label>
      <Select
        items={items}
        value={choice}
        onValueChange={value => {
          if (value === 'custom') {
            setCustomChosen(true);
            if (match) onChange(seconds + 60);
          } else if (value) {
            setCustomChosen(false);
            onChange(Number(value));
          }
        }}
      >
        <SelectTrigger id={`${id}-trigger`} className="w-full" aria-invalid={!!error}
          aria-describedby={error && !showCustom ? `${id}-error` : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {showCustom && (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            className="w-28"
            value={Math.round(seconds / 60)}
            onChange={e => onChange(Math.round(Number(e.target.value) * 60))}
            aria-label={`${label} in minutes`}
            aria-describedby={error ? `${id}-hint ${id}-error` : `${id}-hint`}
            aria-invalid={!!error}
          />
          <span className="text-sm text-muted-foreground">minutes</span>
        </div>
      )}
      <p id={`${id}-hint`} className="text-sm text-muted-foreground">{hint}</p>
      {error && <p id={`${id}-error`} className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
