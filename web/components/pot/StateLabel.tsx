import { cn } from 'cn';
import type { StateInfo, StateTone } from './potState';

/** Plain text state word. Colour is never alone: the word always travels with it. */
const TONES: Record<StateTone, string> = {
  accent: 'text-foreground',
  neutral: 'text-muted-foreground',
  warning: 'text-warning',
  success: 'text-success',
  danger: 'text-destructive',
};

export function StateLabel({ info, className }: { info: Pick<StateInfo, 'label' | 'tone'>; className?: string }) {
  return <span className={cn('text-[17px] font-semibold whitespace-nowrap', TONES[info.tone], className)}>{info.label}</span>;
}
