'use client';

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
  const choice = match ? String(match.seconds) : 'custom';
  const items = [...presets.map(p => ({ value: String(p.seconds), label: p.label })), { value: 'custom', label: 'Custom' }];
  return (
    <div className="space-y-2">
      <Label htmlFor={`${id}-trigger`}>{label}</Label>
      <Select
        items={items}
        value={choice}
        onValueChange={value => {
          if (value === 'custom') onChange(match ? seconds + 60 : seconds);
          else if (value) onChange(Number(value));
        }}
      >
        <SelectTrigger id={`${id}-trigger`} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(item => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {choice === 'custom' && (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            className="w-28"
            value={Math.round(seconds / 60)}
            onChange={e => onChange(Math.round(Number(e.target.value) * 60))}
            aria-invalid={!!error}
          />
          <span className="text-sm text-muted-foreground">minutes</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{hint}</p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
