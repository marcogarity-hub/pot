import { cn } from 'cn';
import type { StateInfo, StateTone } from './potState';

/** A pot state as text on a tinted ground with a square marker, so the state never rests on colour alone. */
const TONES: Record<StateTone, { ground: string; marker: string }> = {
  accent: { ground: 'bg-secondary text-accent-foreground', marker: 'bg-primary' },
  neutral: { ground: 'bg-muted text-foreground', marker: 'bg-foreground' },
  warning: { ground: 'bg-warning-soft text-warning', marker: 'bg-warning' },
  success: { ground: 'bg-success-soft text-success', marker: 'bg-success' },
  danger: { ground: 'bg-destructive-soft text-destructive', marker: 'bg-destructive' },
};

export function StateLabel({ info, className }: { info: Pick<StateInfo, 'label' | 'tone'>; className?: string }) {
  const t = TONES[info.tone];
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1.5 px-2 text-xs font-semibold whitespace-nowrap', t.ground, className)}>
      <span aria-hidden className={cn('size-2', t.marker)} />
      {info.label}
    </span>
  );
}
